# Setup

## Requirements

| Tool           | Version                          | Notes                                                                            |
| -------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| Node.js        | ≥ 22.12 (latest LTS recommended) | See [ADR-007](DECISIONS.md#adr-007--toolchain-pinned-to-node-2212-compatibility) |
| npm            | 10+                              | Ships with Node                                                                  |
| Git            | any recent                       |                                                                                  |
| Docker Desktop | running                          | Local Supabase stack (about 3 GB RAM)                                            |

Keep the repository **outside OneDrive/Dropbox** if possible: syncing `node_modules` and `.next`
causes file locks and slow builds.

## First-time setup

```bash
npm install                                 # dependencies (exact versions from package-lock.json)
npx husky                                   # enable the pre-commit hook (once per clone)
npx playwright install chromium webkit      # browsers for E2E tests (once)
npx supabase start                          # local Supabase in Docker (first run downloads images)
```

## Everyday commands

| Command              | What it does                                                          |
| -------------------- | --------------------------------------------------------------------- |
| `npm run dev`        | Dev server at <http://localhost:3000> (redirects to `/en`)            |
| `npm run typecheck`  | Generates Next route types, then `tsc --noEmit`                       |
| `npm run lint`       | ESLint                                                                |
| `npm run format`     | Prettier (writes changes)                                             |
| `npm run test`       | Vitest unit tests                                                     |
| `npm run test:db`    | Database tests against local Supabase (RLS, invites, admin functions) |
| `npm run test:e2e`   | Builds, starts on port 3100, runs Playwright (3 devices)              |
| `npm run build`      | Production build (same as Vercel)                                     |
| `npm run docs:check` | Documentation gate                                                    |

## Local Supabase

| Command                 | What it does                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `npx supabase start`    | Starts Postgres, Auth, Storage, Studio and Mailpit; applies migrations and the seed on first start |
| `npx supabase status`   | Shows URLs and the local keys                                                                      |
| `npx supabase db reset` | Recreates the database: all migrations, then `supabase/seed.sql`                                   |
| `npx supabase stop`     | Stops the containers (data is kept)                                                                |

| Service           | URL                      |
| ----------------- | ------------------------ |
| API               | <http://127.0.0.1:54321> |
| Studio (DB admin) | <http://127.0.0.1:54323> |
| Mailpit (emails)  | <http://127.0.0.1:54324> |

Auth settings live in `supabase/config.toml`: public sign-up is off (invite-only), passwords need at
least 10 characters with lower- and upper-case letters and digits, and redirect URLs allow ports 3000
(dev) and 3100 (E2E).

### Demo accounts (local only)

Created by `supabase/seed.sql`. All use the local-only password **`Demo@12345`**, which exists only
in local and CI databases.

| Email                          | Role        | Organization / department             |
| ------------------------------ | ----------- | ------------------------------------- |
| `superadmin@visionattend.test` | Super Admin | (platform)                            |
| `admin@demo-college.test`      | Org Admin   | Demo College                          |
| `manager@demo-college.test`    | Manager     | Demo College / Computer Science       |
| `member@demo-college.test`     | Member      | Demo College / Computer Science       |
| `member2@demo-college.test`    | Member      | Demo College / Mechanical Engineering |

## Environment variables

`.env.example` lists every variable by name. For local development, generate `.env.local` (git
ignores it) from the running stack:

```bash
npx supabase start
npm run env:local      # writes .env.local from `supabase status` (local development keys only)
```

The app validates the public variables at startup (`lib/env.ts`) and fails with a clear message if
one is missing. The database tests read the URL and keys straight from `npx supabase status`.

| Name                                   | Used by                                                | Exposed to browser | Added in |
| -------------------------------------- | ------------------------------------------------------ | ------------------ | -------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase clients, `proxy.ts`                           | Yes                | 1b       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase clients (RLS applies)                         | Yes                | 1b       |
| `NEXT_PUBLIC_SITE_URL`                 | Links in emails (from slice 1d)                        | Yes                | 1b       |
| `SUPABASE_SECRET_KEY`                  | Server-only admin client (from slice 1e); bypasses RLS | **No**             | 1b       |

## Deployment

Deployment happens once, at the end of the project (Phase 12, see
[ADR-008](DECISIONS.md#adr-008--deploy-once-at-the-end-of-the-project)). This section will then hold
the exact Vercel, Supabase and Netlify steps.
