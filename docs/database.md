# Database design

Source of truth: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma), plus the
hand-written CHECK constraints at the end of the initial migration.

## 1. Conventions

| Convention     | Decision                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------ |
| Primary keys   | UUIDv7 (`uuid(7)`): not guessable like serial IDs, and time-ordered so B-tree inserts stay local |
| Timestamps     | `timestamptz(3)`, always UTC                                                                     |
| Calendar days  | `date` (work dates, leave, holidays), computed in the **organization's** timezone                |
| Shift times    | Integer minutes after local midnight (0–1439). Avoids Prisma mapping `time` to a fake 1970 date  |
| Naming         | Prisma defaults (PascalCase tables, camelCase columns), so code and SQL use the same names       |
| Deletion       | Business records are never hard-deleted (status changes). Biometrics are hard-deleted            |
| Schema changes | Only through Prisma migrations, which are committed. Never edit a production schema by hand      |

## 2. Multi-tenancy

**Model:** shared database, shared schema, `organizationId` on every tenant-owned table.

| Option                           | Verdict                                                               |
| -------------------------------- | --------------------------------------------------------------------- |
| Database per tenant              | Strongest isolation, but heavy to operate and migrate. Rejected       |
| Schema per tenant                | Same operational cost, awkward with Prisma. Rejected                  |
| Shared schema + `organizationId` | **Chosen.** Simple and scalable; isolation must be enforced           |
| + Postgres row-level security    | Strong future hardening; awkward with Prisma connection pooling today |

**Enforcement has two layers:**

1. **Application:** repositories take a tenant context derived from the JWT. The organization is never
   read from the request body (Phase 2).
2. **Database: composite foreign keys.** Every tenant table has `UNIQUE (organizationId, id)`, and
   references use both columns:

   ```sql
   FOREIGN KEY ("organizationId", "departmentId")
     REFERENCES "Department" ("organizationId", "id")
   ```

   Linking an employee in organization A to a department in organization B is therefore **physically
   impossible**, even if application code has a bug. This was verified during Phase 1: the insert
   fails with `Employee_organizationId_departmentId_fkey`.

## 3. Entity-relationship overview

```text
Organization 1──* User            User 1──0..1 Employee
Organization 1──* Department      Department 1──* Employee
Organization 1──* Shift           Shift 1──* Employee (default shift)
Organization 1──* Holiday         Organization 1──* Camera
Employee 1──0..1 BiometricProfile 1──* FaceTemplate
Employee 1──* AttendanceEvent *──0..1 Camera
Employee 1──* AttendanceRecord (unique per workDate) *──0..1 Shift (snapshot)
Employee 1──* LeaveRequest        Employee 1──* AttendanceCorrection
User 1──* RefreshToken            AuditLog (no FKs: survives deletions)
AttendanceCorrection 1──0..1 AttendanceEvent (created on approval)
```

## 4. Entities

### Organization

The tenant root. `slug` is globally unique. `timezone` (IANA name, e.g. `Asia/Kolkata`) decides
which calendar day an event belongs to. `status` can be ACTIVE or SUSPENDED.

### User — a login identity

- `organizationId` is NULL **only** for SUPER_ADMIN, enforced by CHECK `User_role_organization_check`.
- `email` is globally unique and stored lower-cased (CHECK `User_email_lowercase_check`), so login
  needs no organization slug. _Trade-off:_ one email cannot belong to two organizations.
- `passwordHash` is argon2id and never returned by the API. `failedLoginCount` and `lockedUntil`
  implement account lockout.
- **Why separate from Employee:** not every employee needs a login, and not every admin is an
  employee.

### RefreshToken

Opaque random tokens, stored only as a SHA-256 `tokenHash`. Each use rotates the token
(`replacedById`), and all tokens from one login share a `familyId`. If a token that was already
rotated is presented again, it has been stolen, and the whole family is revoked (reuse detection).
Rows cascade-delete with their user.

### Department, Shift, Holiday

- Department: unique `(organizationId, name)`.
- Shift: `startMinute`, `endMinute`, `graceMinutes`, `halfDayMinutes`, `fullDayMinutes`, and
  `workDays` (ISO weekdays 1–7). **Overnight rule:** if `endMinute <= startMinute`, the shift crosses
  midnight and belongs to the work date it **starts** on. CHECK constraints validate ranges,
  `fullDay ≥ halfDay`, and weekday values.
- Holiday: unique `(organizationId, date)`. Without holidays, every public holiday would look like
  mass absence.

### Employee — the HR record

Unique `(organizationId, employeeCode)`. `departmentId`, `defaultShiftId` and `userId` are optional
composite foreign keys (tenant-safe). The lifecycle is ACTIVE → INACTIVE → TERMINATED, and records
are **never hard-deleted**, so attendance history stays intact. Indexes: `(organizationId, status)`
and `(organizationId, departmentId)`.

### Camera

`direction` (ENTRY, EXIT, BOTH) and `sourceType` (RTSP, WEBCAM, KIOSK). `streamUrlCiphertext` is
encrypted because RTSP URLs usually embed camera credentials. `status` records administrative
intent; online/offline is _derived_ from `lastHeartbeatAt` rather than stored.

### BiometricProfile

Consent and enrollment lifecycle: `consentStatus`, `consentVersion` (which privacy notice was
accepted), `consentGivenAt`, `consentRevokedAt`, `enrollmentStatus`. It is kept apart from the
template bytes so the UI can show "enrolled ✓" without ever touching biometric data.

### FaceTemplate

`ciphertext` holds IV + AES-256-GCM ciphertext + auth tag, together with `keyVersion` (for key
rotation), `modelName` and `modelVersion`. Embeddings from different model versions cannot be
compared, so a model upgrade flags who needs re-enrollment. `qualityScore` must be between 0 and 1.
Rows cascade-delete with their profile. **Only the CV service can decrypt.**

### AttendanceEvent — append-only facts

- `type` is ENTRY or EXIT: what was _observed_. CHECK_IN and CHECK_OUT are _interpretations_ (first
  entry, last exit) computed by the processor, so rules can change and be re-run over the same facts.
  Breaks are the ENTRY/EXIT pairs in the middle of the day.
- `source` is CAMERA, KIOSK, MANUAL or CORRECTION. CHECK: a CAMERA event must have a `cameraId`.
- `capturedAt` (device clock) and `receivedAt` (server clock). `flags` can be CLOCK_SKEW or
  LOW_CONFIDENCE.
- `idempotencyKey` is unique per organization: at-least-once delivery becomes exactly-once storage.
- Wrong events are **voided** (`voidedAt`, `voidReason`), never deleted.
- Indexes: `(organizationId, employeeId, capturedAt)` for one employee's timeline and
  `(organizationId, capturedAt)` for the organization-wide feed.

### AttendanceRecord — a derived projection

Unique `(employeeId, workDate)`. It stores `firstInAt`, `lastOutAt`, `workedMinutes`,
`lateMinutes`, `earlyLeaveMinutes`, and `status` (PRESENT, LATE, HALF_DAY, ABSENT, ON_LEAVE, HOLIDAY
or WEEKLY_OFF). `shiftId` is a snapshot of the shift used, so changing an employee's shift later
does not rewrite history. It can always be rebuilt from events, shift, holidays and leave. Index
`(organizationId, workDate, status)` serves dashboards.

### AttendanceCorrection and LeaveRequest

Both follow the workflow PENDING → APPROVED / REJECTED / CANCELLED, with reviewer and timestamps.
Approving a correction creates a CORRECTION event (linked one-to-one through `correctionId`); the
record is recomputed and **never edited directly**. CHECK: leave `endDate ≥ startDate`.

### AuditLog — append-only

It has **no foreign keys on purpose**: audit history must survive deletion of the users or entities
it describes. `metadata` (JSON) must never contain passwords, tokens or biometric data. Indexes:
`(organizationId, createdAt)` and `(actorUserId, createdAt)`.

## 5. Constraint summary (beyond keys)

| Constraint                                    | Protects against                                         |
| --------------------------------------------- | -------------------------------------------------------- |
| Composite tenant FKs (11)                     | Cross-organization references                            |
| `User_role_organization_check`                | Org users without an org, or a tenant-scoped super admin |
| `User_email_lowercase_check`                  | Duplicate accounts differing only by case                |
| `Shift_minutes_check`, `Shift_workDays_check` | Impossible shift definitions                             |
| `Employee_termination_check`                  | Termination before joining                               |
| `FaceTemplate_quality_check`                  | Out-of-range quality scores                              |
| `AttendanceEvent_scores_check`                | Confidence or liveness outside 0–1                       |
| `AttendanceEvent_camera_source_check`         | Camera events with no camera                             |
| `AttendanceRecord_minutes_check`              | Negative durations                                       |
| `LeaveRequest_dates_check`                    | Leave ending before it starts                            |

## 6. Deliberately deferred

- **Role/Permission tables:** see architecture.md §3.
- **Shift-assignment history:** the shift snapshot on each record preserves history.
- **Recognition attempts** (unknown faces, rejections), for accuracy analytics.
- **Leave balances and accrual.**
- **Postgres row-level security** as a third isolation layer.
- **Separate migration and runtime database roles** (production hardening).

Each of these is one additive migration.

## 7. Working with migrations

```bash
pnpm db:migrate            # create + apply a migration in development (prompts for a name)
pnpm --filter @visionattend/api exec prisma migrate dev --create-only --name <name>
                           # generate SQL without applying, e.g. to add CHECK constraints
pnpm --filter @visionattend/api db:deploy   # apply pending migrations (CI / production)
pnpm db:studio             # browse data
```
