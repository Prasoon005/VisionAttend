# VisionAttend

**AI-powered workforce attendance and access management platform.**

VisionAttend is a multi-tenant platform in which organizations manage employees, departments,
shifts and cameras, and attendance is recorded from verified identity events: face recognition at
registered cameras, kiosk check-ins, or approved manual corrections. Those events are processed into
daily attendance records using each organization's shifts, holidays and leave.

It is designed privacy-first: no raw face images are stored, face templates are encrypted with a
key the main API never holds, and biometric enrollment requires recorded consent.

> **Status: Phase 1 (foundation).** Architecture, schema, service scaffolds, Docker and health
> checks are in place. Features arrive phase by phase — see [docs/roadmap.md](docs/roadmap.md).

## Architecture at a glance

```text
 React SPA ──REST──▶ API (Node/Express/TS) ──▶ PostgreSQL (Prisma)
                          │    ▲
                          │    └── Redis (rate limits · cooldowns · event stream)
                          ▼          ▲
                     CV service (Python/FastAPI/OpenCV) ◀── cameras
```

| Component      | Path              | Role                                                               |
| -------------- | ----------------- | ------------------------------------------------------------------ |
| Web app        | `apps/web`        | Admin/HR console and employee portal                               |
| API            | `apps/api`        | Business rules, auth, RBAC, tenancy; the only database writer      |
| CV service     | `apps/cv-service` | Face detection, quality, embeddings, matching (internal only)      |
| Shared package | `packages/shared` | Zod schemas, types, roles and permission catalog used by web + API |
| Infrastructure | `infrastructure/` | Dockerfiles and nginx config                                       |

Details: [architecture](docs/architecture.md) · [database](docs/database.md) ·
[API](docs/api.md) · [security](docs/security.md) · [development](docs/development.md) ·
[roadmap](docs/roadmap.md)

## Quick start

Prerequisites: Node.js ≥ 22.13, pnpm 10, Python 3.12+, Docker Desktop.

```bash
cp .env.example .env            # then replace every "replace_with..." value
pnpm install                    # also generates the Prisma client
docker compose up -d            # PostgreSQL + Redis
pnpm db:migrate                 # apply migrations
pnpm db:seed                    # synthetic demo organization

# CV service (separate terminal)
cd apps/cv-service
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:create_app --factory --port 8000

# API and web (separate terminals)
pnpm dev:api                    # http://127.0.0.1:4000/api/v1/health
pnpm dev:web                    # http://localhost:5173
```

Or run everything in containers: `docker compose --profile full up -d --build` and open
<http://localhost:8080>.

The full walkthrough, including the verification steps and troubleshooting, is in
[docs/development.md](docs/development.md).

## Development security note

> Environment variables containing secrets must never be committed to version control. Use
> `.env.example` as a template and create a local `.env` file for development.

- `.env` is git-ignored; `.env.example` contains placeholders only.
- Services **refuse to start** when a secret is missing, too short, or still a placeholder.
- Only synthetic data (e.g. `employee001@example.test`) belongs in this repository — never real
  employee records, face images, embeddings, camera recordings or database dumps.

## Tech stack

React 19 · TypeScript 6 · Vite 8 · Tailwind CSS 4 · React Router · TanStack Query ·
Node.js 22 · Express 5 · Prisma 7 · PostgreSQL 17 · Redis 7 · Python 3.12 · FastAPI · OpenCV ·
NumPy · Docker Compose
