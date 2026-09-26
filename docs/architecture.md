# Architecture

## 1. Scope

VisionAttend is a multi-tenant SaaS attendance platform. Organizations manage their workforce, and
attendance is derived from **verified identity events**: camera recognition, kiosk check-ins, or
approved manual corrections.

**Non-goals:** covert surveillance, tracking of non-enrolled people, storing video, payroll, and
physical door or turnstile control (an integration point is left for it).

**Core design idea:** the attendance engine does not depend on computer vision. Recognition is only
one _source_ of events; manual, kiosk and correction events flow through the same pipeline. The
engine can therefore be built and tested before face recognition exists, and a CV outage can never
corrupt attendance data.

## 2. Requirements

### Functional

| ID    | Area               | Requirement                                                                               |
| ----- | ------------------ | ----------------------------------------------------------------------------------------- |
| FR-1  | Tenancy            | Super Admin creates organizations (timezone, unique slug, active/suspended)               |
| FR-2  | Auth               | Email + password, short-lived access tokens, rotating refresh tokens, lockout             |
| FR-3  | RBAC               | Permission-based authorization for Super Admin, Org Admin/HR, Employee                    |
| FR-4  | Org setup          | CRUD for departments, shifts (incl. overnight), holidays                                  |
| FR-5  | Employees          | CRUD, optional portal login, lifecycle Active → Inactive → Terminated (no hard delete)    |
| FR-6  | Cameras            | Register with location, direction (entry/exit/both), source (RTSP/webcam/kiosk)           |
| FR-7  | Biometrics         | Consent → capture → quality gate → encrypted template; revoking consent deletes templates |
| FR-8  | Recognition        | Detect → match within the camera's organization → event, with threshold and cooldown      |
| FR-9  | Events             | Append-only log (camera, kiosk, manual, correction) with idempotency keys                 |
| FR-10 | Records            | One derived record per employee per work date: in/out, worked, late, early, status        |
| FR-11 | Corrections        | Employee requests → HR reviews → approval creates a correction event → record recomputed  |
| FR-12 | Leave              | Employee requests → HR reviews → approved days become ON_LEAVE                            |
| FR-13 | Employee portal    | Own attendance, hours, leave, corrections and profile only                                |
| FR-14 | Audit              | Append-only audit trail of security and admin actions                                     |
| FR-15 | Analytics, reports | Daily/monthly/department views, CSV/PDF export _(later)_                                  |
| FR-16 | Intelligence       | Liveness, anomaly detection, natural-language analytics _(later)_                         |

### Non-functional

| Category         | Target                                                                         |
| ---------------- | ------------------------------------------------------------------------------ |
| Security         | OWASP ASVS L1 practices, argon2id, TLS in production, no secrets in the repo   |
| Privacy          | No raw images stored; encrypted templates; consent; defined retention/deletion |
| Tenant isolation | No query can return another organization's data (app layer + DB constraints)   |
| Latency          | Recognition → recorded event < 2 s; API p95 < 300 ms at demo scale             |
| Reliability      | CV events buffered while the API is down; at-least-once delivery, idempotent   |
| Correctness      | UTC storage; work dates in org timezone; overnight shifts supported            |
| Scalability      | Stateless services; CV service scales horizontally per camera group            |
| Maintainability  | Strict TypeScript, layered modules, shared schemas, Prisma migrations          |
| Observability    | Structured JSON logs, request IDs propagated across services, health endpoints |

## 3. Roles

| Role               | Scope       | Can                                                            | Cannot                                           |
| ------------------ | ----------- | -------------------------------------------------------------- | ------------------------------------------------ |
| **Super Admin**    | Platform    | Create/suspend organizations, first Org Admin, platform health | Read any tenant's employee/biometric data        |
| **Org Admin / HR** | One org     | Everything inside their organization                           | See other orgs; read template bytes (nobody can) |
| **Employee**       | Own records | View own attendance/leave, request corrections and leave       | See others' data; approve anything               |

The Super Admin's restriction is deliberate least privilege: the platform operator is not the data
controller for a tenant's workforce data.

**Permissions live in code; routes check permissions, not roles** (`requirePermission('employee:write')`).
The role → permission map is a typed constant in `packages/shared/src/permissions.ts`.
_Alternative considered:_ database `Role`/`Permission` tables for custom per-organization roles.
Rejected for now because no requirement needs custom roles, and because routes already check
permissions, moving roles into the database later changes no route.

## 4. System architecture

```text
┌──────────────────────────────┐      ┌──────────────────────────────┐
│   Web App (React/TS/Vite)    │      │ Kiosk page (same web app,    │
│   Admin/HR + Employee portal │      │ device-token auth) [later]   │
└──────────────┬───────────────┘      └───────────────┬──────────────┘
               │ HTTPS REST  (+ WebSocket later)      │
┌──────────────▼──────────────────────────────────────▼──────────────┐
│                     Backend API  (Node/Express/TS)                 │
│  auth · RBAC · tenancy · validation · business rules · audit       │
│  ┌─────────────────────┐   ┌──────────────────────────────────┐    │
│  │ HTTP modules        │   │ Attendance worker (same codebase,│    │
│  │ (controllers/svc)   │   │ consumes Redis Stream) [Phase 4] │    │
│  └─────────────────────┘   └──────────────────────────────────┘    │
└───────┬───────────────────────────┬────────────────────▲───────────┘
        │ Prisma                    │ rate-limit, cooldown│ XREADGROUP
┌───────▼────────┐          ┌───────▼────────────────────┴──┐
│  PostgreSQL    │          │            Redis              │
│ (system of     │          │ rate limits · cooldown keys · │
│  record)       │          │ stream: attendance.events     │
└────────────────┘          └───────────────▲───────────────┘
        ▲                                   │ XADD recognition events
        │ internal HTTP (service token)     │
        │ enroll / fetch encrypted gallery  │
┌───────┴───────────────────────────────────┴───────────────────────┐
│            CV Service (Python / FastAPI / OpenCV / NumPy)         │
│  frame ingest → detect → quality → embed → match → (liveness)     │
│  holds TEMPLATE_ENCRYPTION_KEY · in-memory per-org gallery        │
│  NOT exposed publicly (internal Docker network only)              │
└───────────────────────────────▲───────────────────────────────────┘
                                │ RTSP / webcam / kiosk frames
                             Cameras
```

### Service responsibilities

| Component             | Responsibility                                                                                                                  | Why it is separate                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Web**               | UI for three audiences; no business rules beyond input validation for user experience                                           | Deploys as static files                                                                             |
| **API**               | Owns business rules, authorization, tenancy and the database — the **only** Postgres writer                                     | One writer means one migration source, one place for authorization, one audit trail                 |
| **Attendance worker** | Consumes recognition events, re-validates them, deduplicates, writes events, recomputes records                                 | Same codebase as the API (reuses services) but its own process, so event bursts do not slow HTTP    |
| **CV service**        | Pixels only: detection, quality, embeddings, matching, later liveness. Knows embeddings and IDs, not shifts or attendance rules | CPU/GPU heavy and Python-native; a slow model never blocks the login endpoint; scales independently |
| **PostgreSQL**        | System of record                                                                                                                | Relational data with strong integrity needs                                                         |
| **Redis**             | Exactly three jobs (below)                                                                                                      | Each is a genuine fit, not Redis for its own sake                                                   |

**Redis's three jobs**

1. **Rate limiting** — counters shared by all API instances.
2. **Recognition cooldown** — `SET cooldown:{org}:{emp}:{cam} NX EX 60` atomically stops one person
   standing in front of a camera from producing 30 events per second.
3. **Event stream `attendance.events`** — buffers events between the CV service and the worker. If
   the API or database is down, events wait in Redis instead of being lost; consumer groups give
   acknowledgement and retry.

## 5. Data flow: recognition → attendance (target, Phase 6)

1. The CV service reads a frame, detects faces and runs a quality gate (blur, size, pose).
2. It computes an embedding and compares it by cosine similarity against the in-memory gallery of
   **that camera's organization only**.
3. Below the threshold, the face is counted as unknown. Nothing is stored and no image is kept.
4. On a match it takes the Redis cooldown lock. If the lock is already held, the event is dropped as
   a duplicate.
5. `XADD attendance.events {idempotencyKey, orgId, employeeId, cameraId, confidence, capturedAt}`.
6. The worker reads the event and **re-validates** it: is the employee active, and does the camera
   belong to that organization? Only the API decides what counts as attendance, so a compromised CV
   service cannot mark someone from another organization.
7. It inserts an `AttendanceEvent`. The unique idempotency key makes retries harmless.
8. It recomputes the `AttendanceRecord` for (employee, work date) from that day's events and the
   shift.
9. It acknowledges the stream message and (later) pushes a WebSocket update to dashboards.

## 6. Communication

| Path      | Mechanism                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------- |
| Web ↔ API | REST under `/api/v1`, JSON, one error envelope, Zod schemas shared via `packages/shared`             |
| API → CV  | Internal HTTP with an `X-Service-Token` header (constant-time comparison); CV port never published   |
| CV → API  | Redis Stream (Phase 4+) — decoupled, buffered, at-least-once                                         |
| Tracing   | `X-Request-Id` accepted if well-formed, otherwise generated; returned on every response and logged   |
| Time      | Events carry `capturedAt` (device) and `receivedAt` (server); a large gap sets the `CLOCK_SKEW` flag |

## 7. Health model

| Endpoint                     | Meaning                                                                                     | Used by                    |
| ---------------------------- | ------------------------------------------------------------------------------------------- | -------------------------- |
| `GET /api/v1/health`         | **Liveness**: the process is running; never touches dependencies                            | Container `HEALTHCHECK`    |
| `GET /api/v1/health/ready`   | **Readiness**: database, Redis and CV (authenticated call) all respond → 200, otherwise 503 | Load balancer, status page |
| `GET /health` (CV)           | CV liveness, plus the OpenCV/NumPy versions                                                 | Container `HEALTHCHECK`    |
| `GET /internal/v1/info` (CV) | Token-protected; proves API ↔ CV connectivity **and** shared-secret configuration           | API readiness              |

Keeping liveness separate from readiness matters: if liveness checked the database, a database
outage would make the orchestrator restart healthy API processes in a loop.

## 8. Technology decisions

| Choice                             | Reason                                                                                            | Rejected alternative                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| pnpm workspaces                    | Strict dependency layout catches undeclared imports; fast                                         | npm workspaces (looser); Turborepo (not needed yet)               |
| One `packages/shared`              | Zod schemas _are_ the types (`z.infer`), so splitting "types" from "schemas" would duplicate them | Separate `types`/`config` packages                                |
| Express 5                          | Stable; async errors reach the error handler natively                                             | NestJS — more framework magic to explain                          |
| Prisma 7 (driver adapter `pg`)     | Typed client, migration history, readable schema                                                  | TypeORM (weaker typing)                                           |
| Zod 4                              | One schema validates on the server and types the client                                           | class-validator (backend only)                                    |
| TypeScript 6                       | Latest version supported by typescript-eslint (TS 7 is not yet)                                   | TS 7                                                              |
| TanStack Query + Axios             | Server-state caching and retries; interceptors for token refresh                                  | Redux (overkill), bare fetch                                      |
| pino / JSON logging                | Structured, redacted, correlated by request ID                                                    | console.log                                                       |
| Vitest + Supertest; pytest         | Fast; Vitest shares Vite's configuration                                                          | Jest                                                              |
| ruff + mypy (strict)               | Fast lint + strict types for Python                                                               | flake8 + black                                                    |
| UUIDv7 primary keys                | Globally unique, not guessable like serial IDs, time-ordered for index locality                   | serial integers, UUIDv4                                           |
| _(Phase 5)_ ONNX Runtime + ArcFace | Accurate 512-d embeddings on CPU                                                                  | `face_recognition`/dlib (less accurate, hard to build on Windows) |

## 9. Risks

| Risk                                        | Impact               | Mitigation                                                                                   |
| ------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| Cross-tenant data leak                      | Critical             | Tenant context in repositories, composite foreign keys, cross-tenant tests                   |
| Photo or phone-screen spoofing              | High                 | Liveness (Phase 7); until then a documented limitation plus low-confidence review            |
| False matches                               | High                 | Conservative threshold, several templates per person, quality gate, confidence stored        |
| Demographic bias of face models             | Medium               | Documented limitations; manual and correction paths; never the only way to record attendance |
| Docker on Windows cannot reach a USB webcam | Blocks demos         | Run the CV service natively in development; kiosk (browser webcam) path                      |
| ML wheels lag new Python versions           | Blocks Phase 5       | Docker pinned to Python 3.12                                                                 |
| Project inside OneDrive                     | File locks           | Move the repo outside OneDrive (see development.md)                                          |
| Timezones and overnight shifts              | Wrong data           | UTC storage, org timezone, work-date rule, tests with a fixed clock                          |
| Clock drift and network outages             | Wrong or lost events | `capturedAt` + `receivedAt`, skew flag, Redis Stream buffering, idempotency keys             |
| Scope creep                                 | Unfinished project   | Phase gates; each phase ends in a demonstrable state                                         |
