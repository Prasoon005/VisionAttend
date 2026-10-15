# Phase 1 — Authentication & account management

## 1. Goal

Secure sign-in and account management for a multi-tenant platform: invite-only accounts, separate
admin and member sign-in, role-based redirects, session handling, password flows, rate limiting and
lockout, organization onboarding, admin user management, and personal profile settings. Row Level
Security in Postgres is the final authority for every rule.

## 2. Status

In Progress (started 2026-10-16).

| Slice | Scope                                                                                   | Status  |
| ----- | --------------------------------------------------------------------------------------- | ------- |
| 1a    | Schema, RLS, admin functions, invite-only sign-up, seed, DB tests                       | Done    |
| 1b    | Supabase clients, session refresh in `proxy.ts`, protected routes                       | Next    |
| 1c    | Member and Admin sign-in pages, role redirect, magic link, sign-out (incl. all devices) | Planned |
| 1d    | Email verification, forgot/reset password, auth callback                                | Planned |
| 1e    | Rate limiting (Upstash), lockout, password-strength meter, auth audit                   | Planned |
| 1f    | Organization onboarding, invites by email and by link/code                              | Planned |
| 1g    | Admin user management                                                                   | Planned |
| 1h    | Profile & settings, avatar, data download, delete account                               | Planned |
| 1i    | E2E flows on 3 devices, docs completion                                                 | Planned |

## 3. Features built

- **Data model:** organizations, departments, profiles, invites, audit logs
  ([DATABASE.md](../DATABASE.md)).
- **Row Level Security** on every table, using helpers that read the caller's current profile, so
  role changes and deactivation apply immediately.
- **Column-level privileges:** users can update only their personal columns.
- **Admin functions:** `admin_update_member`, `admin_set_member_status`, `admin_delete_member`, with
  last-admin protection and an audit row in the same transaction.
- **Invite-only sign-up**, enforced by triggers on `auth.users`; tokens are stored only as hashes.
- **Append-only audit log**, protected even from the table owner.
- **Seed:** Demo College with 3 departments and one account per role.

## 4. Files added/changed

| Path                                                          | Purpose                                                                                   |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `supabase/config.toml`                                        | Local Supabase config (invite-only auth, password rules, redirect URLs, lighter services) |
| `supabase/migrations/20261016000100_identity_and_tenancy.sql` | Schema, RLS, functions, triggers                                                          |
| `supabase/seed.sql`                                           | Local demo data                                                                           |
| `tests/db/*`, `vitest.db.config.mts`                          | Database tests (`npm run test:db`)                                                        |
| `.github/workflows/ci.yml`                                    | Starts Supabase in CI and runs the database tests                                         |
| `package.json`                                                | `supabase` CLI, `@supabase/supabase-js`, `test:db` script                                 |

## 5. Database changes

`20261016000100_identity_and_tenancy.sql`: enums `user_role`, `org_status`, `profile_status`;
tables `organizations`, `departments`, `profiles`, `invites`, `audit_logs`; `private` helper
functions; triggers on `auth.users` for invite-only sign-up, email sync and token stripping; admin
RPCs; column grants; RLS policies. See [DATABASE.md](../DATABASE.md).

## 6. Environment variables added

None yet. They arrive with slice 1b.

## 7. How to test it

```bash
npx supabase start          # Docker Desktop must be running
npx supabase db reset       # migrations + seed
npm run test:db
```

Manual check: open Studio at <http://127.0.0.1:54323>. The demo organization, departments and five
profiles should be there, and `audit_logs` should reject an edit.

## 8. Verification results

Slice 1a (2026-10-16): `test:db` 54/54 pass. Typecheck, lint, unit tests and `docs:check` all
pass. Full-phase results are added when the phase completes.

## 9. Known limitations & follow-ups

- Deactivation ends data access immediately (RLS), but the session itself is revoked in slice 1g
  (Auth admin ban).
- Supabase's built-in mail sender is heavily rate-limited on cloud projects, so Resend (free tier)
  will be needed at deployment (Phase 12). Locally, Mailpit is used.

## 10. Deviations from the plan

| Plan                                                              | What happened                                                           | Why                                                                                                                                                                |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trusted server code could create users through a bootstrap marker | Only direct SQL (the seed) can; tests create users through real invites | Supabase Auth adds custom `app_metadata` after the insert. Stricter, and better ([ADR-013](../DECISIONS.md#adr-013--invite-only-sign-up-enforced-in-the-database)) |
