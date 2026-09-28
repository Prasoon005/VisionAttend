# Roadmap

Each phase ends in a **demonstrable, tested state**. Attendance logic is built _before_ computer
vision, so recognition simply plugs in as one more event source.

| Phase  | Theme                      | Deliverables                                                                                                                                                                | Status      |
| ------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **1**  | Foundation                 | Architecture, monorepo, Prisma schema + initial migration, API/web/CV scaffolds, Docker, health checks, docs                                                                | ✅ Complete |
| **2**  | Auth and tenancy           | Login, argon2id, JWT + rotating refresh tokens, RBAC middleware, tenant-scoped repositories, organization onboarding by Super Admin, audit logging, rate limiting, login UI | ✅ Complete |
| **3**  | Organization management    | Departments, shifts, holidays, employees, cameras (API + admin UI); cross-tenant tests                                                                                      | Next        |
| **4**  | Attendance engine (no CV)  | Manual/kiosk events, Redis Stream + worker, idempotency, record computation (late, early, half day, overnight), fixed-clock tests, daily attendance view                    |             |
| **5**  | CV enrollment              | Detection, quality gate, ArcFace (ONNX) embeddings, AES-GCM template encryption, consent flow, deletion/retention                                                           |             |
| **6**  | Recognition                | Camera ingestion, per-organization matching, thresholds, Redis cooldown, events into the Phase 4 engine, live WebSocket feed                                                |             |
| **7**  | Liveness and camera health | Anti-spoofing, camera heartbeats, offline alerts                                                                                                                            |             |
| **8**  | Leave and corrections      | Request/review workflows, employee self-service portal                                                                                                                      |             |
| **9**  | Analytics and reports      | Daily/monthly/department dashboards (Recharts), working-hour statistics, CSV/PDF export                                                                                     |             |
| **10** | Intelligence               | Attendance anomaly detection, natural-language HR analytics, report summaries, RAG over policy documents                                                                    |             |
| **11** | Hardening                  | Coverage targets, CI pipeline, load test, security review, deployment, viva documentation                                                                                   |             |

## Phase 1 outcome

- A pnpm workspace containing `apps/api`, `apps/web` and `packages/shared`; `apps/cv-service` in Python.
- A 15-entity schema with 11 tenant-safe composite foreign keys and 10 CHECK constraints, migrated
  and seeded.
- Health endpoints on every service, with readiness that checks the database, Redis and an
  authenticated CV call.
- A live System Status page in the web app.
- Fail-fast environment validation in the API and the CV service.
- A Docker Compose stack (infrastructure-only by default, or everything with `--profile full`),
  non-root containers, and nginx serving the SPA.
- Tests: 23 JavaScript/TypeScript + 6 Python. Strict typecheck, ESLint, Prettier, ruff and mypy all
  clean.

## Phase 2 outcome

- **Auth:** argon2id passwords (`@node-rs/argon2`), 15-minute HS256 access JWTs (`jose`, algorithm
  pinned), opaque rotating refresh tokens in an `httpOnly; Secure; SameSite=Strict` cookie with
  reuse detection, account lockout (5 failures → 15 minutes), forced password change for generated
  passwords.
- **Authorization:** `authenticate()` + `requirePermission()` middleware; tenant-scoped
  repositories; other tenants' records return 404.
- **Onboarding:** Super Admin creates an organization and its first Org Admin in one transaction.
  The admin receives a one-time generated password, shown once.
- **Audit:** login, failed login, logout, token reuse, password change and organization changes.
  Rows are written in the same transaction as the change they describe.
- **Rate limiting:** Redis fixed window. Global limit 300/min per IP; login 20 per 15 min per IP.
  Fails open if Redis is unavailable.
- **Web:** login page, in-memory access token, silent refresh (de-duplicated in each tab and
  serialized across tabs), permission-aware routes and navigation, forced password change,
  organizations console, security activity feed for Org Admins.
- **Tests:** 46 unit tests (4 shared, 36 API, 6 web) plus 30 integration tests against real
  PostgreSQL and Redis (`pnpm --filter @visionattend/api test:integration`).

## Open follow-ups

- Move the repository out of OneDrive.
- Upgrade Node.js to ≥ 22.13.
- Install Python 3.12 locally before Phase 5.
- Add route-level code splitting in the web app (the bundle is about 748 KB after Phase 2).
- Periodically delete expired and revoked `RefreshToken` rows (a scheduled job, Phase 4 worker).
- Move to Postgres row-level security as defence in depth for tenant isolation (Phase 11).
