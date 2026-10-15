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
