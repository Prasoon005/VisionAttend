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
| 1b    | Supabase clients, session refresh in `proxy.ts`, protected routes                       | Done    |
| 1c    | Member and Admin sign-in pages, role redirect, magic link, sign-out (incl. all devices) | Next    |
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
- **Sessions (1b):** cookie-based Supabase sessions via `@supabase/ssr`; `proxy.ts` refreshes them on
  every request.
- **Route protection (1b):** signed-out visitors are redirected to the member or admin sign-in page
  with a validated `next` target; every protected page checks the live role (`requireRole`).
- **Role homes (1b):** `/platform` (Super Admin: organization count, recent organizations), `/admin`
  (Org Admin: active members, pending invitations, departments), `/dashboard` (members: organization,
  role, department), all read through RLS.
- **Role-aware navigation (1b)** and a profile menu that shows the signed-in user.

## 4. Files added/changed

| Path                                                              | Purpose                                                                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `supabase/config.toml`                                            | Local Supabase config (invite-only auth, password rules, redirect URLs, lighter services)                      |
| `supabase/migrations/20261016000100_identity_and_tenancy.sql`     | Schema, RLS, functions, triggers                                                                               |
| `supabase/seed.sql`                                               | Local demo data                                                                                                |
| `tests/db/*`, `vitest.db.config.mts`                              | Database tests (`npm run test:db`)                                                                             |
| `.github/workflows/ci.yml`                                        | Starts Supabase in CI and runs the database tests                                                              |
| `package.json`                                                    | `supabase` CLI, `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `server-only`; `test:db`, `env:local` scripts |
| `lib/env.ts`, `scripts/write-env-local.mjs`, `.env.example`       | Validated public config; local `.env.local` generator                                                          |
| `lib/supabase/server.ts`, `lib/supabase/proxy.ts`                 | Server client (acts as the user), session refresh for the proxy                                                |
| `lib/auth/route-access.ts`, `lib/auth/session.ts`                 | Access rules, role homes, safe `next`; live session + `requireRole`                                            |
| `proxy.ts`                                                        | Locale + session refresh + sign-in gate                                                                        |
| `app/[locale]/(protected)/{dashboard,admin,platform}/page.tsx`    | Role homes                                                                                                     |
| `components/shell/*`                                              | Role-filtered navigation, profile menu with the signed-in user                                                 |
| `tests/unit/route-access.test.ts`, `tests/e2e/auth-guard.spec.ts` | Access-rule unit tests; redirect E2E                                                                           |

## 5. Database changes

`20261016000100_identity_and_tenancy.sql`: enums `user_role`, `org_status`, `profile_status`;
tables `organizations`, `departments`, `profiles`, `invites`, `audit_logs`; `private` helper
functions; triggers on `auth.users` for invite-only sign-up, email sync and token stripping; admin
RPCs; column grants; RLS policies. See [DATABASE.md](../DATABASE.md).

## 6. Environment variables added

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`,
`SUPABASE_SECRET_KEY` (server only). Details in [SETUP.md](../SETUP.md#environment-variables).
Generate them locally with `npm run env:local`.

## 7. How to test it

```bash
npx supabase start          # Docker Desktop must be running
npx supabase db reset       # migrations + seed
npm run test:db
```

Manual check: open Studio at <http://127.0.0.1:54323>. The demo organization, departments and five
profiles should be there, and `audit_logs` should reject an edit.

## 8. Verification results

| Slice | Date       | Results                                                                                                 |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------- |
| 1a    | 2026-10-16 | `test:db` 54/54; typecheck, lint, unit, `docs:check` pass                                               |
| 1b    | 2026-10-16 | typecheck, lint pass; unit 54/54; `test:db` 54/54; build pass; E2E 51/51 (3 devices); `docs:check` pass |

Full-phase results are added when the phase completes.

## 9. Known limitations & follow-ups

- Deactivation ends data access immediately (RLS), but the session itself is revoked in slice 1g
  (Auth admin ban).
- Every page is now rendered per request (the shell reads the session), so pages are no longer
  prerendered at build time. This is expected for a signed-in app.
- Until slice 1c, the sign-in pages don't exist yet: the redirect works, but its target shows the
  404 page.
- Supabase's built-in mail sender is heavily rate-limited on cloud projects, so Resend (free tier)
  will be needed at deployment (Phase 12). Locally, Mailpit is used.

## 10. Deviations from the plan

| Plan                                                              | What happened                                                                               | Why                                                                                                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Proxy checks roles (route protection layer)                       | Proxy checks only that a user is signed in; each page checks the role from the live profile | Roles aren't in the token (ADR-014); a database lookup in the proxy would slow every request. See ADR-017                                                          |
| Trusted server code could create users through a bootstrap marker | Only direct SQL (the seed) can; tests create users through real invites                     | Supabase Auth adds custom `app_metadata` after the insert. Stricter, and better ([ADR-013](../DECISIONS.md#adr-013--invite-only-sign-up-enforced-in-the-database)) |
