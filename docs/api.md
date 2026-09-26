# API

## Conventions

| Topic            | Convention                                                                           |
| ---------------- | ------------------------------------------------------------------------------------ |
| Base path        | `/api/v1` — the version is in the URL so breaking changes can coexist                |
| Format           | JSON; request bodies are limited to 100 KB                                           |
| Validation       | Zod schemas from `@visionattend/shared`; unknown keys are stripped                   |
| Auth _(Phase 2)_ | `Authorization: Bearer <access JWT>` (15 min); refresh token in an `httpOnly` cookie |
| Tenancy          | The organization always comes from the token, never from the URL or body             |
| Pagination       | Cursor-based for event feeds (`?cursor=&limit=`); offset-based for small admin lists |
| Tracing          | Every response carries `X-Request-Id` (a well-formed incoming one is reused)         |
| Time             | ISO-8601 UTC timestamps; `YYYY-MM-DD` for work dates                                 |

### Error envelope

Every error, including 404 and 500, has this shape (`apiErrorResponseSchema`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "requestId": "0192f4b1-…",
    "details": [{ "path": "email", "message": "Invalid email" }]
  }
}
```

| Status | `code`             | When                                                                                                   |
| ------ | ------------------ | ------------------------------------------------------------------------------------------------------ |
| 400    | `VALIDATION_ERROR` | The body, query or params failed schema validation                                                     |
| 400    | `INVALID_JSON`     | Malformed JSON body                                                                                    |
| 401    | `UNAUTHENTICATED`  | Missing or expired token _(Phase 2)_                                                                   |
| 403    | `FORBIDDEN`        | Authenticated but lacking the permission _(Phase 2)_                                                   |
| 404    | `NOT_FOUND`        | Unknown route or resource — also used for other tenants' resources, so their existence is not revealed |
| 409    | `CONFLICT`         | Uniqueness violation, e.g. a duplicate employee code                                                   |
| 429    | `RATE_LIMITED`     | Too many requests _(Phase 2)_                                                                          |
| 500    | `INTERNAL_ERROR`   | Unexpected error; details are logged, never returned                                                   |

## Implemented (Phase 1)

### `GET /api/v1/health` — liveness

```json
{ "status": "ok", "service": "api", "version": "0.1.0", "uptimeSeconds": 42, "timestamp": "…" }
```

### `GET /api/v1/health/ready` — readiness

Returns 200 when every dependency responds and 503 otherwise. Checks run in parallel with a 2 s
timeout each. Failures report only `unavailable` or `timeout`; the real cause is logged server-side.

```json
{
  "status": "ready",
  "checks": {
    "database": { "status": "up", "latencyMs": 3 },
    "redis": { "status": "up", "latencyMs": 2 },
    "cvService": { "status": "up", "latencyMs": 5 }
  },
  "timestamp": "…"
}
```

### CV service (internal network only)

| Endpoint                | Auth              | Purpose                                      |
| ----------------------- | ----------------- | -------------------------------------------- |
| `GET /health`           | none              | Liveness, plus the OpenCV and NumPy versions |
| `GET /internal/v1/info` | `X-Service-Token` | Service version and loaded models (none yet) |

## Planned endpoints

Every endpoint lists the permission it requires (see `packages/shared/src/permissions.ts`).

| Phase | Method & path                                                        | Permission                                   |
| ----- | -------------------------------------------------------------------- | -------------------------------------------- |
| 2     | `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout`      | public / cookie                              |
| 2     | `GET /auth/me`                                                       | authenticated                                |
| 2     | `POST /platform/organizations` · `PATCH /platform/organizations/:id` | `organization:manage`                        |
| 3     | `GET/POST /departments` · `PATCH/DELETE /departments/:id`            | `department:write` (write)                   |
| 3     | `GET/POST /shifts` · `PATCH /shifts/:id`                             | `shift:write` (write)                        |
| 3     | `GET/POST /holidays` · `DELETE /holidays/:id`                        | `holiday:write` (write)                      |
| 3     | `GET/POST /employees` · `GET/PATCH /employees/:id`                   | `employee:read` / `employee:write`           |
| 3     | `GET/POST /cameras` · `PATCH /cameras/:id`                           | `camera:read` / `camera:write`               |
| 4     | `POST /attendance/events` (manual/kiosk)                             | `attendance:write`                           |
| 4     | `GET /attendance/records?date=&departmentId=`                        | `attendance:read`                            |
| 4     | `GET /me/attendance?from=&to=`                                       | `attendance:read:own`                        |
| 5     | `POST /employees/:id/biometric/consent`                              | `biometric:enroll`                           |
| 5     | `POST /employees/:id/biometric/enroll` (images → CV, discarded)      | `biometric:enroll`                           |
| 5     | `DELETE /employees/:id/biometric`                                    | `biometric:delete`                           |
| 8     | `POST /me/corrections` · `POST /me/leave`                            | `correction:create:own` / `leave:create:own` |
| 8     | `POST /corrections/:id/approve                                       | reject`                                      | `correction:review` |
| 8     | `POST /leave/:id/approve                                             | reject`                                      | `leave:review`      |
| 9     | `GET /reports/attendance?month=&format=csv`                          | `report:read`                                |
| 2+    | `GET /audit-logs`                                                    | `audit:read`                                 |
