# Security and privacy

Legend: ✅ implemented in Phase 1 · 🔜 planned (phase noted)

## 1. Secrets management

| Control                                                                                                                                                    | Status |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| All secrets come from environment variables; none are in source, Dockerfiles or Compose                                                                    | ✅     |
| `.env` is git-ignored and docker-ignored; `.env.example` holds placeholders only                                                                           | ✅     |
| API validates its environment with Zod at startup (`apps/api/src/config/env.ts`): missing, short (< 32 characters) or placeholder secrets stop the process | ✅     |
| CV service does the same with pydantic-settings (`SecretStr`, min length, placeholder check)                                                               | ✅     |
| Validation errors name the variable but **never echo its value** (covered by a test)                                                                       | ✅     |
| Compose uses `${VAR:?}` so it refuses to start without required values                                                                                     | ✅     |
| Postgres and Redis ports are bound to `127.0.0.1` only; Redis requires a password                                                                          | ✅     |
| CV service port is not published at all (reachable only on the internal Docker network)                                                                    | ✅     |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 2. Authentication (🔜 Phase 2)

- **Passwords:** argon2id (memory-hard, the current OWASP recommendation), with login-attempt
  counting and temporary lockout (`failedLoginCount`, `lockedUntil`).
- **Access token:** JWT signed with `JWT_SECRET`, 15-minute lifetime. The SPA keeps it **in memory
  only**, never in `localStorage`, where any XSS could read it.
- **Refresh token:** an opaque 256-bit random value in an `httpOnly; Secure; SameSite=Strict` cookie
  scoped to `/api/v1/auth`, and stored in the database only as a SHA-256 hash.
  - _Why opaque rather than a second JWT_ (and hence no `JWT_REFRESH_SECRET`): the server can revoke
    it, and a database leak does not reveal usable tokens.
  - **Rotation with reuse detection:** every refresh issues a new token. Presenting an
    already-rotated token revokes the whole token family.
- **Rate limiting:** Redis-backed, stricter on `/auth/*`.

## 3. Authorization

| Control                                                                                                                             | Status |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Permission catalog and role map in `packages/shared` (tests ensure employees and the Super Admin cannot reach admin or tenant data) | ✅     |
| Prisma `Role` enum kept in sync with the shared roles (test)                                                                        | ✅     |
| Middleware chain `authenticate → resolveTenant → requirePermission(...)` on every route                                             | 🔜 2   |
| Tenant ID taken only from the token; other tenants' resources return 404, not 403                                                   | 🔜 2   |
| Composite tenant foreign keys and CHECK constraints in the database                                                                 | ✅     |

## 4. HTTP hardening

| Control                                                                             | Status            |
| ----------------------------------------------------------------------------------- | ----------------- |
| `helmet` secure headers (CSP, nosniff, frame-ancestors…); `X-Powered-By` removed    | ✅                |
| CORS: explicit allowlist from `CORS_ORIGINS`, credentials enabled                   | ✅                |
| 100 KB JSON body limit; malformed JSON returns 400                                  | ✅                |
| Centralized error handler: stack traces are logged, never returned                  | ✅                |
| Readiness never exposes internal hostnames or driver errors (covered by a test)     | ✅                |
| Logger redacts `authorization`, cookies, `x-service-token`, passwords and tokens    | ✅                |
| Input validation with Zod on every route; Prisma parameterizes all SQL              | ✅ / 🔜 per route |
| `X-Request-Id` accepted only if it matches `^[\w-]{8,64}$` (prevents log injection) | ✅                |
| Nginx (container): `server_tokens off`, nosniff, `X-Frame-Options: DENY`            | ✅                |

## 5. Service-to-service

The API calls the CV service with an `X-Service-Token` header. The CV service compares it with
`secrets.compare_digest`, a constant-time comparison, so response timing reveals nothing about how
much of a guessed token was right. Every `/internal/*` route requires the token at router level.
The API readiness check calls an authenticated endpoint, so a misconfigured token shows up
immediately as `cvService: down`.

**Production upgrade path:** mutual TLS between services, or short-lived signed service tokens.

## 6. Biometric privacy

VisionAttend is an attendance system for **consenting employees**, not a surveillance tool.

| Principle              | Design                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Consent first**      | No enrollment without a recorded `consentStatus = GRANTED` and the notice version (`consentVersion`)                                                                                  |
| **Data minimization**  | Frames are processed in memory and discarded. No face image is ever written to disk or the database. Only a 512-float embedding is kept.                                              |
| **Encryption at rest** | Embeddings are encrypted with AES-256-GCM (authenticated encryption, so tampering is detected)                                                                                        |
| **Split custody**      | The CV service holds `TEMPLATE_ENCRYPTION_KEY` but has no database access. The API and Postgres store ciphertext but never hold the key. Compromising one side alone reveals nothing. |
| **Key rotation**       | `keyVersion` on every template; templates are re-encrypted on rotation                                                                                                                |
| **Purpose limitation** | Matching is scoped to the camera's organization. Unknown faces yield only a count: no identity, no image, no tracking.                                                                |
| **Right to erasure**   | Revoking consent or terminating an employee hard-deletes their templates (cascade) and writes an audit entry                                                                          |
| **Retention**          | Scheduled job removes templates of long-inactive employees _(Phase 5)_                                                                                                                |
| **Access**             | No public endpoint returns template data, not even to Org Admins                                                                                                                      |
| **Auditability**       | Enrollment, deletion, consent changes and exports are audit-logged                                                                                                                    |

**Known limitation until Phase 7:** without liveness detection, a printed photo or phone screen
could be used to spoof recognition. It is mitigated by confidence thresholds, HR review of
low-confidence events, and correction workflows.

## 7. Audit logging

`AuditLog` is append-only and has no foreign keys, so records survive deletions. It captures the
actor, action (e.g. `auth.login_failed`, `employee.update`, `biometric.delete`), entity, request ID,
IP and user agent. `metadata` is scrubbed: it never contains passwords, tokens or embeddings.

## 8. Repository hygiene

The following must never be committed: `.env` files, keys and certificates, `node_modules`, virtual
environments, build output, logs, database dumps, `data/`, `uploads/`, `storage/`, face images,
embeddings (`*.npy`), model weights (`*.onnx`), and camera recordings (`*.mp4`). This is enforced by
`.gitignore` and `.dockerignore`.

Only synthetic data is used, such as `Employee 001` and `employee001@example.test` (`.test` is a
reserved TLD). Any computer-vision test images must be synthetic, or public with a documented
licence permitting the use.

## 9. Database access (🔜 production)

- A runtime role with DML-only privileges; a separate migration role with DDL privileges.
- TLS to the database; no public exposure.
- Encrypted backups with a restore drill.
