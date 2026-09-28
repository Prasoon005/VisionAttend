# Development guide

## Prerequisites

| Tool           | Version                 | Notes                                                            |
| -------------- | ----------------------- | ---------------------------------------------------------------- |
| Node.js        | **≥ 22.13**             | 22.12 installs with engine warnings; upgrade to 22 LTS or 24 LTS |
| pnpm           | 10.x                    | `corepack enable` or `npm i -g pnpm`                             |
| Python         | 3.12 (3.13 works today) | ML libraries added in Phase 5 may lag on 3.13                    |
| Docker Desktop | recent                  | Runs PostgreSQL and Redis                                        |

> ⚠️ **Keep the repository outside OneDrive, Dropbox and similar folders.** Sync clients lock files
> inside `node_modules/` and `.venv/` while you install, which causes random `EBUSY` or "permission
> denied" errors. This happened during Phase 1 setup. Use a folder such as `C:\dev\visionattend`.

## Repository layout

```text
visionattend/
├── apps/
│   ├── api/                 Express API
│   │   ├── prisma/          schema.prisma, migrations/, seed.ts
│   │   ├── src/
│   │   │   ├── config/      env validation (fails fast)
│   │   │   ├── lib/         logger, prisma, redis, errors, password, tokens, rate-limiter, request-context
│   │   │   ├── middleware/  error handling, authenticate/requirePermission, rate limiting
│   │   │   ├── modules/     one folder per feature: *.routes → *.controller → *.service (→ *.repository)
│   │   │   ├── generated/   Prisma client (generated, git-ignored)
│   │   │   ├── app.ts       builds the Express app (dependencies injected, so it is testable)
│   │   │   └── server.ts    wiring, startup, graceful shutdown
│   │   └── tests/           unit tests; integration/ runs against real Postgres + Redis
│   ├── web/                 React SPA
│   │   └── src/
│   │       ├── app/         router, layout
│   │       ├── components/  reusable UI
│   │       ├── features/    one folder per feature (api hooks + pages)
│   │       └── lib/api/     the single HTTP client
│   └── cv-service/          FastAPI (Python, not part of the pnpm workspace)
│       ├── app/{api,schemas}/  config.py, main.py (services/ arrives in Phase 5)
│       └── tests/
├── packages/shared/         Zod schemas, types, roles, permissions
├── infrastructure/docker/   Dockerfiles, nginx.conf
├── docs/
├── docker-compose.yml
└── .env.example
```

**Layering rule (API):** routes only map URLs → controllers only translate HTTP ↔ service calls →
services hold business rules → repositories hold Prisma queries and enforce tenant scoping
(`TenantContext` from the token). Business logic never lives in route handlers. `app.ts` is the
composition root that builds every service once and injects it.

## First-time setup

```bash
# 1. Configuration
cp .env.example .env
#    Replace every "replace_with..." value. Generate secrets with:
#    node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
#    POSTGRES_PASSWORD must match the password inside DATABASE_URL (same for Redis).

# 2. JavaScript dependencies (also runs `prisma generate`)
pnpm install

# 3. Infrastructure
docker compose up -d
docker compose ps              # postgres and redis should become "healthy"

# 4. Database
pnpm db:migrate                # applies migrations
pnpm db:seed                   # synthetic "demo" organization, 5 employees, 3 logins

# 5. CV service
cd apps/cv-service
python -m venv .venv
.venv\Scripts\activate         # PowerShell. macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
cd ../..
```

## Running locally

Use three terminals:

```bash
# CV service
cd apps/cv-service && .venv\Scripts\activate
uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 --reload

# API (tsx watch; rebuilds shared first)
pnpm dev:api

# Web (Vite; proxies /api → 127.0.0.1:4000)
pnpm dev:web
```

| URL                                         | Expect                            |
| ------------------------------------------- | --------------------------------- |
| <http://localhost:5173>                     | Login page                        |
| <http://127.0.0.1:4000/api/v1/health>       | `{"status":"ok",…}`               |
| <http://127.0.0.1:4000/api/v1/health/ready> | `{"status":"ready",…}` (HTTP 200) |
| <http://127.0.0.1:8000/docs>                | CV service OpenAPI docs           |

### Demo logins (from `pnpm db:seed`)

All use the password in `SEED_USER_PASSWORD` (`.env`). Re-running the seed resets them and clears
lockouts.

| Email                      | Role        | Sees                                              |
| -------------------------- | ----------- | ------------------------------------------------- |
| `superadmin@example.test`  | Super Admin | Organizations console, System status              |
| `admin@demo.example.test`  | Org Admin   | Demo Organization home + security activity feed   |
| `employee001@example.test` | Employee    | Self-service home (attendance arrives in Phase 4) |

**Why run the CV service natively in development?** Docker Desktop on Windows cannot pass a USB
webcam through to Linux containers. Running the CV service natively keeps the camera accessible for
Phases 5–6.

### Full stack in containers

```bash
docker compose --profile full up -d --build
# open http://localhost:8080 (nginx serves the SPA and proxies /api to the API container)
docker compose --profile full down          # stop (data volumes are kept)
docker compose down -v                      # ⚠ also deletes database and Redis data
```

The API container applies pending migrations on startup.

## Quality checks

```bash
pnpm typecheck        # strict TypeScript across all packages
pnpm lint             # ESLint (typescript-eslint strict, no `any`)
pnpm format:check     # Prettier
pnpm test             # Vitest unit tests: shared + api + web (no database needed)
pnpm --filter @visionattend/api test:integration   # real Postgres + Redis (docker compose up -d)

cd apps/cv-service
python -m pytest
python -m ruff check . && python -m ruff format --check .
python -m mypy app tests      # strict
```

API unit tests build the app through `createApp()` with fake dependencies, so they need **no**
database, Redis or CV service. Integration tests (`apps/api/tests/integration`) migrate and use a
separate database, always named `<your database>_test`, and Redis logical database 15. They wipe
every table between tests, which is why they never use your development database.

## Environment variables

| Variable                              | Used by     | Notes                                                                                       |
| ------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `NODE_ENV`                            | api         | development / test / production                                                             |
| `LOG_LEVEL`                           | api, cv     | `info` by default                                                                           |
| `API_PORT`                            | api         | 4000                                                                                        |
| `CORS_ORIGINS`                        | api         | Comma-separated allowlist                                                                   |
| `POSTGRES_USER` / `_PASSWORD` / `_DB` | compose     | Create the database container                                                               |
| `DATABASE_URL`                        | api, prisma | Use `127.0.0.1`, not `localhost` (Node may resolve IPv6 `::1`, but ports are bound to IPv4) |
| `REDIS_PASSWORD`                      | compose     | Redis `requirepass`                                                                         |
| `REDIS_URL`                           | api         | `redis://:PASSWORD@127.0.0.1:6379`                                                          |
| `JWT_SECRET`                          | api         | ≥ 32 characters; signs access tokens                                                        |
| `SEED_USER_PASSWORD`                  | seed        | ≥ 12 characters; password of the synthetic demo logins                                      |
| `CV_SERVICE_URL`                      | api         | `http://127.0.0.1:8000`                                                                     |
| `CV_SERVICE_TOKEN`                    | api, cv     | ≥ 32 characters; must be identical on both sides                                            |
| `VITE_API_URL`                        | web         | Empty in development (Vite proxy)                                                           |

Future variables: `TEMPLATE_ENCRYPTION_KEY` (CV only, Phase 5).

## Troubleshooting

| Symptom                                      | Fix                                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Invalid environment configuration` on start | The message names the variable: fix it in `.env`                                                                        |
| `Can't reach database server at ::1:5432`    | Use `127.0.0.1` in `DATABASE_URL`                                                                                       |
| Readiness shows `cvService: down`            | CV service not running, or `CV_SERVICE_TOKEN` differs between sides                                                     |
| `EBUSY` / permission errors during install   | The repo is inside OneDrive: move it                                                                                    |
| `ERR_PNPM_UNSUPPORTED_ENGINE`                | Upgrade Node.js to ≥ 22.13                                                                                              |
| Prisma client import errors                  | `pnpm --filter @visionattend/api db:generate`                                                                           |
| Demo login says "Invalid email or password"  | Locked after 5 failures (15 min), or re-run `pnpm db:seed`                                                              |
| Signed out after every reload                | Open the app on `localhost` through the Vite proxy (the refresh cookie is `Secure` and path-scoped)                     |
| `429 RATE_LIMITED` while testing             | Wait for `Retry-After`, or `docker compose exec redis sh -c 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning FLUSHDB'` |

## Conventions

- **TypeScript:** strict, `noUncheckedIndexedAccess`, no `any` (lint error). ESM everywhere.
- **Validation:** request and response shapes are Zod schemas in `packages/shared`; types come from
  `z.infer`.
- **Python:** type hints everywhere, Pydantic models at every boundary, mypy strict.
- **Database:** every schema change is a Prisma migration. Never edit a shared database by hand.
- **Data:** synthetic only (`@example.test`).
- **Git:** handled manually by the project author.
