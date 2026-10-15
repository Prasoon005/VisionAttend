# Architecture Decision Records

Each record states what was chosen, the alternatives considered and why. Newest last.

---

## ADR-001 — Rebuild on Next.js + Supabase

- **Date:** 2026-10-15 · **Status:** Accepted
- **Context:** The first implementation (React/Vite + Express + Prisma + a Python CV service +
  Docker) had finished authentication and tenancy. `CLAUDE.md` then fixed a new target: free-tier
  deployment on Vercel + Supabase, face AI in the browser, voice, i18n, PWA.
- **Options:** (a) keep the stack and adopt the new features; (b) keep the stack but move face AI to
  the browser; (c) rebuild per `CLAUDE.md`.
- **Decision:** (c) rebuild. Chosen by the project owner.
- **Consequences:** Free hosting becomes straightforward (no Python or Express server to host).
  Earlier code is retired and kept under git tag `legacy-v1`; its proven design principles are
  carried into `DATABASE.md`.

## ADR-002 — shadcn/ui on Radix, "Nova" style, with the `cn` package

- **Date:** 2026-10-15 · **Status:** Accepted
- **Decision:** shadcn/ui with Radix primitives (mature, accessible, well documented) instead of
  Base UI or React Aria. Nova preset (Lucide icons). RTL mode on, so components use logical CSS
  properties (`ms-`, `pe-`, `start-`). shadcn now installs `cn`, its own official package
  (`shadcn-ui/cn`, published by shadcn), which replaces `clsx` + `tailwind-merge`. It was checked
  before being accepted.
- **Consequences:** Components are copied into `components/ui/` and owned by us. Badge was extended
  with `success` and `warning` variants.

## ADR-003 — `motion` package for Framer Motion

- **Date:** 2026-10-15 · **Status:** Accepted
- **Decision:** Framer Motion is now published as `motion` (`motion/react`), and that is the
  package used. Presets live in `lib/motion.ts`; `MotionConfig reducedMotion="user"` honours OS
  accessibility settings.

## ADR-004 — `next-intl` with always-prefixed locale URLs

- **Date:** 2026-10-15 · **Status:** Accepted
- **Options:** prefix only non-default locales (`as-needed`), or always prefix.
- **Decision:** `localePrefix: 'always'` (`/en/…`, `/hi/…`). Every URL is unambiguous and shareable
  in a specific language, and caching per locale is simple. Translation keys are type-checked
  against `messages/en.json`, and a unit test enforces identical keys and placeholders across
  locales.

## ADR-005 — TypeScript 6.0, not 7.0

- **Date:** 2026-10-15 · **Status:** Accepted (revisit when typescript-eslint supports TS 7)
- **Context:** TypeScript 7 (native compiler) is the newest release, and the project type-checked
  cleanly with it, but `typescript-eslint` refuses to run on TS 7.0.
- **Decision:** Pin TypeScript 6.0.3, the line Microsoft recommends for tools that need the JS API.

## ADR-006 — TanStack Table v8

- **Date:** 2026-10-15 · **Status:** Accepted
- **Decision:** Pin `@tanstack/react-table` 8.21.3. v9 is a breaking redesign (`useReactTable` and
  row models renamed), and the shadcn DataTable pattern is built on v8. Sorting is opt-in per
  column (`defaultColumn.enableSorting = false`), because a table-level flag overrides every column.

## ADR-007 — Toolchain pinned to Node 22.12 compatibility

- **Date:** 2026-10-15 · **Status:** Accepted (revisit after upgrading Node)
- **Context:** The development machine runs Node 22.12. `jsdom` 30 needs Node ≥ 22.22 (it uses zstd
  decompression), and failed to start.
- **Decision:** Pin `jsdom` 28.1.0, the newest release that supports 22.12. Every other dependency
  supports 22.12 (`engines.node >= 22.12`). CI uses the latest Node 22.

## ADR-008 — Deploy once, at the end of the project

- **Date:** 2026-10-15 · **Status:** Accepted (project owner's decision)
- **Decision:** No Vercel deployment during Phase 0 (`CLAUDE.md` asked for an empty-shell deploy).
  CI already runs the production build (`next build`, the same command Vercel runs) on every push,
  so build problems surface early. Deployment happens in Phase 12.

## ADR-009 — Husky is installed manually by the project owner

- **Date:** 2026-10-15 · **Status:** Accepted
- **Context:** Husky's usual `prepare` script runs `git config core.hooksPath`, but the assistant
  must never run git commands (`CLAUDE.md` Rule 2).
- **Decision:** No `prepare` script. The owner runs `npx husky` once after cloning; from then on
  `.husky/pre-commit` runs `lint-staged` (ESLint + Prettier on staged files).

## ADR-010 — Accept a dev-only `braces` advisory

- **Date:** 2026-10-15 · **Status:** Accepted (re-check on each upgrade)
- **Context:** `npm audit` reports 5 "high" issues, all from one advisory (GHSA-vfj7-8cjw-p6xm,
  denial of service through deeply nested glob patterns) in `braces`, reached via
  `eslint-config-next` → `fast-glob`. `npm audit --omit=dev` reports **0** vulnerabilities.
- **Decision:** Accept. The flaw is only reachable through glob patterns in our own lint config,
  never through user input, and the suggested `--force` fix downgrades to the Next 14 ESLint
  config, which breaks linting.

## ADR-011 — Local Supabase (CLI + Docker) for development and CI

- **Date:** 2026-10-16 · **Status:** Accepted
- **Options:** a free cloud Supabase project now, or the local stack via `supabase start`.
- **Decision:** Local stack. No account needed until deployment; tests can reset the database
  freely; emails go to a local Mailpit inbox that E2E tests can read; CI runs the identical stack.
  The Supabase CLI is a pinned dev dependency (`npx supabase …`), so there is no global install.
- **Consequences:** Docker Desktop must be running (about 3 GB RAM). Cloud setup happens in Phase 12.

## ADR-012 — Organizations are created by the Super Admin only

- **Date:** 2026-10-16 · **Status:** Accepted
- **Decision:** No self-serve organization sign-up. The Super Admin creates each organization and
  invites its first Org Admin. Avoids abuse handling and fits colleges and companies being onboarded
  deliberately.

## ADR-013 — Invite-only sign-up enforced in the database

- **Date:** 2026-10-16 · **Status:** Accepted
- **Options:** (a) rely on the app only calling sign-up after checking an invite; (b) Supabase Auth
  hooks; (c) triggers on `auth.users`.
- **Decision:** (c). A `BEFORE INSERT` trigger rejects any new login without a valid, unexpired,
  unrevoked invite token (or the SQL-only bootstrap marker used by the seed), consumes it, and an
  `AFTER INSERT` trigger creates the profile from the invite. Public sign-up is also disabled in Auth
  settings.
- **Why:** Even if application code had a bug, or public sign-up were enabled by mistake, nobody can
  join an organization without an invitation. Tokens are stored only as SHA-256 hashes.
- **Discovered while building:** Supabase Auth adds custom `app_metadata` after the insert, so the
  bootstrap path is usable only from direct SQL. That is stricter than planned, and better. Auth
  also rewrites `user_metadata` after the insert, so a second trigger strips the token on every
  write.

## ADR-014 — Policies read the current profile, not JWT claims

- **Date:** 2026-10-16 · **Status:** Accepted
- **Options:** put `org_id` and `role` into the access token with a Custom Access Token Hook, or look
  them up in `profiles` in `SECURITY DEFINER` helpers.
- **Decision:** Look them up (`private.my_org_id()`, `private.my_role()`). Claims would stay stale
  until the token refreshes (up to 1 hour), so a deactivated member or a demoted admin would keep
  access. The lookup is a primary-key read, wrapped in `(select …)` so Postgres runs it once per
  query.

## ADR-015 — Column-level privileges for self-service edits

- **Date:** 2026-10-16 · **Status:** Accepted
- **Decision:** RLS decides _which rows_ a user may update; column `GRANT`s decide _which columns_.
  Users can update only their personal columns. Role, department and status change through
  `admin_*` functions that check permissions and write the audit row in the same transaction.
  Protects against a user sending `{ role: 'org_admin' }` straight to the API.

## ADR-016 — Account lockout counters in Redis

- **Date:** 2026-10-16 · **Status:** Accepted (implemented in slice 1e)
- **Decision:** Failed sign-in counters and lockouts (5 failures → 15 minutes) live in Redis with a
  TTL, not in a table: they expire on their own and need no clean-up job. Locally and in CI an
  Upstash-compatible emulator container is used, so the same `@upstash/ratelimit` code runs offline.

## ADR-017 — Proxy checks sign-in; pages check roles

- **Date:** 2026-10-16 · **Status:** Accepted
- **Context:** `CLAUDE.md` asks for three enforcement layers: route protection, server-side checks
  and RLS. Roles are deliberately not in the access token (ADR-014).
- **Decision:** `proxy.ts` refreshes the session and redirects signed-out visitors (cheap: no
  database query). Each protected page calls `requireRole()`, which reads the live profile once per
  request (React `cache`) and redirects users with the wrong role to their own home. RLS remains the
  final authority for every query.
- **Why not check roles in the proxy:** a profile lookup on every request (including assets and
  prefetches) adds latency, and Next.js advises keeping the proxy light. Layouts aren't used as the
  guard because they don't re-run on client-side navigation; pages do.
- **Consequence:** pages render per request (they read cookies), so they are no longer prerendered.
