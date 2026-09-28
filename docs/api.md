# API

## Conventions

| Topic      | Convention                                                                           |
| ---------- | ------------------------------------------------------------------------------------ |
| Base path  | `/api/v1` — the version is in the URL so breaking changes can coexist                |
| Format     | JSON; request bodies are limited to 100 KB                                           |
| Validation | Zod schemas from `@visionattend/shared`; unknown keys are stripped                   |
| Auth       | `Authorization: Bearer <access JWT>` (15 min); refresh token in an `httpOnly` cookie |
| Tenancy    | The organization always comes from the token, never from the URL or body             |
| Pagination | Cursor-based for event feeds (`?cursor=&limit=`); offset-based for small admin lists |
| Tracing    | Every response carries `X-Request-Id` (a well-formed incoming one is reused)         |
| Time       | ISO-8601 UTC timestamps; `YYYY-MM-DD` for work dates                                 |

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

| Status | `code`                                        | When                                                                                                   |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 400    | `VALIDATION_ERROR`                            | The body, query or params failed schema validation                                                     |
| 400    | `INVALID_JSON`                                | Malformed JSON body                                                                                    |
| 401    | `UNAUTHENTICATED`                             | No bearer token                                                                                        |
| 401    | `TOKEN_INVALID`                               | Access token malformed, forged or expired: the client should refresh                                   |
| 401    | `INVALID_CREDENTIALS`                         | Wrong email or password, or the account is locked (deliberately indistinguishable)                     |
| 401    | `SESSION_EXPIRED`                             | Refresh cookie missing, expired, revoked or reused                                                     |
| 403    | `FORBIDDEN`                                   | Authenticated but lacking the permission                                                               |
| 403    | `PASSWORD_CHANGE_REQUIRED`                    | Signed in with a one-time password that must be changed first                                          |
| 403    | `ACCOUNT_DISABLED` / `ORGANIZATION_SUSPENDED` | Correct password, but access is switched off                                                           |
| 404    | `NOT_FOUND`                                   | Unknown route or resource — also used for other tenants' resources, so their existence is not revealed |
| 409    | `CONFLICT`                                    | Uniqueness violation, e.g. a duplicate employee code                                                   |
| 429    | `RATE_LIMITED`                                | Too many requests; see `Retry-After`                                                                   |
| 500    | `INTERNAL_ERROR`                              | Unexpected error; details are logged, never returned                                                   |

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

## Implemented (Phase 2)

Schemas: `packages/shared/src/{auth,organizations,audit,pagination}.ts`.

### Auth — `/api/v1/auth`

| Method & path                | Auth                                       | Body → response                                                                |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| `POST /auth/login`           | public, 20 per 15 min per IP               | `{ email, password }` → `200 AuthSession` + `Set-Cookie: va_refresh`           |
| `POST /auth/refresh`         | `va_refresh` cookie                        | → `200 AuthSession` + rotated cookie · `401 SESSION_EXPIRED` (cookie cleared)  |
| `POST /auth/logout`          | cookie (optional)                          | → `204`, family revoked, cookie cleared. Idempotent                            |
| `POST /auth/change-password` | bearer (allowed while a change is pending) | `{ currentPassword, newPassword }` → `200 AuthSession`; other sessions revoked |
| `GET /auth/me`               | bearer (allowed while a change is pending) | → `AuthUser`                                                                   |

```jsonc
// AuthSession
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs…",
  "expiresIn": 900,
  "user": {
    "id": "…",
    "email": "admin@demo.example.test",
    "role": "ORG_ADMIN",
    "organization": {
      "id": "…",
      "name": "Demo Organization",
      "slug": "demo",
      "timezone": "Asia/Kolkata",
    },
    "mustChangePassword": false,
    "permissions": ["employee:read", "…"],
  },
}
```

### Platform — `/api/v1/platform/organizations` (`organization:manage`, Super Admin)

| Method & path | Body → response                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `GET /`       | `?page=&pageSize=` → `{ items: Organization[], total, page, pageSize }`                                                |
| `POST /`      | `{ name, slug, timezone, adminEmail }` → `201 { organization, admin, temporaryPassword }` · `409` duplicate slug/email |
| `PATCH /:id`  | any of `{ name, timezone, status }` → `Organization`. `status: SUSPENDED` revokes every session of the organization    |

### Audit — `/api/v1/audit-logs` (`audit:read`, tenant-scoped)

| Method & path | Response                                                               |
| ------------- | ---------------------------------------------------------------------- |
| `GET /`       | `?page=&pageSize=` → the caller's organization's entries, newest first |
| `GET /:id`    | One entry · `404` if it belongs to another organization                |

### CV service (internal network only)

| Endpoint                | Auth              | Purpose                                      |
| ----------------------- | ----------------- | -------------------------------------------- |
| `GET /health`           | none              | Liveness, plus the OpenCV and NumPy versions |
| `GET /internal/v1/info` | `X-Service-Token` | Service version and loaded models (none yet) |

## Planned endpoints

Every endpoint lists the permission it requires (see `packages/shared/src/permissions.ts`).

| Phase | Method & path                                                   | Permission                                   |
| ----- | --------------------------------------------------------------- | -------------------------------------------- |
| 3     | `GET/POST /departments` · `PATCH/DELETE /departments/:id`       | `department:write` (write)                   |
| 3     | `GET/POST /shifts` · `PATCH /shifts/:id`                        | `shift:write` (write)                        |
| 3     | `GET/POST /holidays` · `DELETE /holidays/:id`                   | `holiday:write` (write)                      |
| 3     | `GET/POST /employees` · `GET/PATCH /employees/:id`              | `employee:read` / `employee:write`           |
| 3     | `GET/POST /cameras` · `PATCH /cameras/:id`                      | `camera:read` / `camera:write`               |
| 4     | `POST /attendance/events` (manual/kiosk)                        | `attendance:write`                           |
| 4     | `GET /attendance/records?date=&departmentId=`                   | `attendance:read`                            |
| 4     | `GET /me/attendance?from=&to=`                                  | `attendance:read:own`                        |
| 5     | `POST /employees/:id/biometric/consent`                         | `biometric:enroll`                           |
| 5     | `POST /employees/:id/biometric/enroll` (images → CV, discarded) | `biometric:enroll`                           |
| 5     | `DELETE /employees/:id/biometric`                               | `biometric:delete`                           |
| 8     | `POST /me/corrections` · `POST /me/leave`                       | `correction:create:own` / `leave:create:own` |
| 8     | `POST /corrections/:id/approve                                  | reject`                                      | `correction:review` |
| 8     | `POST /leave/:id/approve                                        | reject`                                      | `leave:review`      |
| 9     | `GET /reports/attendance?month=&format=csv`                     | `report:read`                                |
