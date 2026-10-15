# Setup

## Requirements

| Tool    | Version                          | Notes                                                                            |
| ------- | -------------------------------- | -------------------------------------------------------------------------------- |
| Node.js | ≥ 22.12 (latest LTS recommended) | See [ADR-007](DECISIONS.md#adr-007--toolchain-pinned-to-node-2212-compatibility) |
| npm     | 10+                              | Ships with Node                                                                  |
| Git     | any recent                       |                                                                                  |

Keep the repository **outside OneDrive/Dropbox** if possible: syncing `node_modules` and `.next`
causes file locks and slow builds.

## First-time setup

```bash
npm install                                 # dependencies (exact versions from package-lock.json)
npx husky                                   # enable the pre-commit hook (once per clone)
npx playwright install chromium webkit      # browsers for E2E tests (once)
```

## Everyday commands

| Command              | What it does                                               |
| -------------------- | ---------------------------------------------------------- |
| `npm run dev`        | Dev server at <http://localhost:3000> (redirects to `/en`) |
| `npm run typecheck`  | Generates Next route types, then `tsc --noEmit`            |
| `npm run lint`       | ESLint                                                     |
| `npm run format`     | Prettier (writes changes)                                  |
| `npm run test`       | Vitest unit tests                                          |
| `npm run test:e2e`   | Builds, starts on port 3100, runs Playwright (3 devices)   |
| `npm run build`      | Production build (same as Vercel)                          |
| `npm run docs:check` | Documentation gate                                         |

## Environment variables

Phase 0 needs **none**. `.env.example` lists every variable by name. Copy it to `.env.local` (git
ignores it) when variables are introduced in Phase 1 (Supabase, Upstash).

| Name     | Used by | Added in |
| -------- | ------- | -------- |
| none yet |         |          |

## Deployment

Deployment happens once, at the end of the project (Phase 12, see
[ADR-008](DECISIONS.md#adr-008--deploy-once-at-the-end-of-the-project)). This section will then
hold the exact Vercel, Supabase and Netlify steps.
