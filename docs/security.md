# Security and privacy

Legend: ✅ implemented · 🔜 planned (phase noted)

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

## 2. Authentication (✅ Phase 2)

Code: `apps/api/src/modules/auth/`, `apps/api/src/lib/{password,tokens,rate-limiter}.ts`.

| Control                        | Design                                                                                                                                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Password hashing**           | argon2id, OWASP baseline (19 MiB, t=2, p=1), random salt per hash (`@node-rs/argon2`: prebuilt binaries, no native build step)                                                                                                                                         |
| **Password policy**            | 12–128 characters (NIST 800-63B: length over composition rules; the maximum stops hash-flooding)                                                                                                                                                                       |
| **No user enumeration**        | Unknown email, wrong password and locked account all return the same `401 INVALID_CREDENTIALS`. An unknown email still costs one argon2 verification against a dummy hash, so timing is the same too                                                                   |
| **Lockout**                    | 5 wrong passwords → locked for 15 minutes. The counter increments atomically in SQL, so parallel guesses cannot race it                                                                                                                                                |
| **Access token**               | HS256 JWT signed with `JWT_SECRET`, 15 minutes. Claims: `sub`, `role`, `org`, `pwc` (password change pending). Verification pins the algorithm (blocks `alg: none`) and checks issuer and audience. The SPA keeps it **in memory only**, never in `localStorage`       |
| **Refresh token**              | Opaque 256-bit value in an `httpOnly; Secure; SameSite=Strict` cookie scoped to `/api/v1/auth`, 7-day sliding expiry, stored only as a SHA-256 hash                                                                                                                    |
| **Rotation + reuse detection** | Every refresh issues a new token and revokes the old one with a conditional update. Presenting an already-rotated token, or losing a concurrent race, revokes the whole family and writes `auth.refresh_reuse`                                                         |
| **Revocation**                 | Logout revokes the family. Changing the password revokes all of the user's tokens. Suspending an organization revokes all of its users' tokens                                                                                                                         |
| **Status checks**              | Login and refresh refuse disabled users (`ACCOUNT_DISABLED`) and suspended organizations (`ORGANIZATION_SUSPENDED`), and say so only after the password was verified                                                                                                   |
| **Onboarding**                 | The first Org Admin gets a generated 144-bit one-time password, shown once (`Cache-Control: no-store`), with `mustChangePassword` set                                                                                                                                  |
| **Rate limiting**              | Redis fixed window (`INCR` + `PEXPIRE NX` in one `MULTI`). Limits: 300/min per IP for the whole API (not health), 20 per 15 min per IP for login, 60 per 15 min for refresh, 10 per 15 min per user for password change. Sends `RateLimit-*` and `Retry-After` headers |

**Design decisions and trade-offs**

- _Opaque refresh token, not a second JWT_ (hence no `JWT_REFRESH_SECRET`): the server can revoke
  it, and a database leak does not reveal usable tokens.
- _Stateless access-token check:_ `authenticate` does no database lookup. Disabling a user takes
  effect at their next refresh, **at most 15 minutes later**. The alternative, a user lookup on
  every request, trades one query per request for instant revocation; it is worth revisiting if
  that becomes a requirement.
- _Rate limiter fails open:_ if Redis is down, requests are allowed and a warning is logged.
  Database lockout still protects each account, and a cache outage should not lock everyone out.
- _CSRF:_ the only cookie is `SameSite=Strict` and path-scoped to `/api/v1/auth`. Every other
  endpoint needs a bearer header that a cross-site form cannot set. CORS is an explicit allowlist.
- _Several tabs:_ the SPA serializes refreshes across tabs with the Web Locks API, so two tabs cannot
  present the same refresh token and trip reuse detection.
- _`trust proxy`_ is limited to loopback and private networks (Vite proxy, nginx), so
  `X-Forwarded-For` cannot be spoofed from outside to dodge rate limits or falsify audit IPs.

## 3. Authorization

| Control                                                                                                                             | Status |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Permission catalog and role map in `packages/shared` (tests ensure employees and the Super Admin cannot reach admin or tenant data) | ✅     |
| Prisma `Role` enum kept in sync with the shared roles (test)                                                                        | ✅     |
| Middleware chain `authenticate() → requirePermission(...)`, then `getTenant(req)` in the handler, on every protected route          | ✅     |
| A pending password change blocks every endpoint except `me`, `change-password` and `logout` (`PASSWORD_CHANGE_REQUIRED`)            | ✅     |
| Tenant ID taken only from the token; other tenants' resources return 404, not 403 (integration-tested)                              | ✅     |
| Composite tenant foreign keys and CHECK constraints in the database                                                                 | ✅     |

## 4. HTTP hardening

| Control                                                                                 | Status |
| --------------------------------------------------------------------------------------- | ------ |
| `helmet` secure headers (CSP, nosniff, frame-ancestors…); `X-Powered-By` removed        | ✅     |
| CORS: explicit allowlist from `CORS_ORIGINS`, credentials enabled                       | ✅     |
| 100 KB JSON body limit; malformed JSON returns 400                                      | ✅     |
| Centralized error handler: stack traces are logged, never returned                      | ✅     |
| Readiness never exposes internal hostnames or driver errors (covered by a test)         | ✅     |
| Logger redacts `authorization`, cookies, `x-service-token`, passwords and tokens        | ✅     |
| Input validation with Zod on every route; Prisma parameterizes all SQL                  | ✅     |
| Unique-constraint violations map to `409 CONFLICT` (checked by the database, race-free) | ✅     |
| Token-bearing responses send `Cache-Control: no-store`                                  | ✅     |
| `X-Request-Id` accepted only if it matches `^[\w-]{8,64}$` (prevents log injection)     | ✅     |
| Nginx (container): `server_tokens off`, nosniff, `X-Frame-Options: DENY`                | ✅     |

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

Since Phase 2 it records: `auth.login`, `auth.login_failed` (with a reason:
`unknown_email`/`wrong_password`/`locked`), `auth.logout`, `auth.refresh_reuse`,
`auth.password_changed`, `organization.create` and `organization.update`. Audit rows for data
changes are written **in the same transaction** as the change, so neither can exist without the
other. Standalone events (failed logins) are best-effort: a failed audit write is logged but never
fails the request. Org Admins read their own organization's trail through `GET /audit-logs`. The
Super Admin cannot, on purpose.

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
