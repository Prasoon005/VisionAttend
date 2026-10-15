# Phase 0 — Project setup & foundation

## 1. Goal

A production-grade empty application that every later phase builds on: Next.js with strict
TypeScript, a design system, a responsive app shell, English and Hindi from day one, automated tests
on desktop and phones, CI running the verification gate, and the documentation skeleton.

## 2. Status

Complete (started and finished 2026-10-15).

## 3. Features built

| Feature          | Description                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js app      | Next.js 16 App Router, React 19, TypeScript 6 strict (+ `noUncheckedIndexedAccess`)                                                                               |
| Design tokens    | OKLCH semantic colors (brand indigo, success, warning), radius scale, light and dark palettes                                                                     |
| Theming          | Light / Dark / System via `next-themes`, no flash on load                                                                                                         |
| Typography       | Geist for Latin, Noto Sans Devanagari for Hindi, via `next/font` (self-hosted at build)                                                                           |
| Motion presets   | `fast`, `base`, `spring`, `fadeIn`, `slideUp`, `scaleIn`, `stagger`; honours reduced motion                                                                       |
| Components       | Button, Card, Badge (+ success/warning), Dialog, Toast (sonner), Skeleton, EmptyState, DataTable, DropdownMenu, Popover, Tooltip, Avatar, Sheet, Separator, Table |
| App shell        | Desktop sidebar, mobile bottom bar (safe-area aware, animated indicator), sticky top bar, skip link                                                               |
| Top bar controls | Language switcher, theme toggle, notifications panel (empty state), profile menu (guest)                                                                          |
| i18n             | `next-intl`, English + Hindi, `/en` and `/hi` URLs, type-checked keys, RTL-ready layout                                                                           |
| Pages            | Home, Design system reference, localized 404                                                                                                                      |
| Quality tooling  | ESLint (Next + TS rules, no `any`), Prettier with Tailwind class sorting, Husky + lint-staged                                                                     |
| Tests            | 24 Vitest unit tests; 36 Playwright E2E tests (12 flows × 3 devices)                                                                                              |
| CI               | GitHub Actions: typecheck → lint → format → unit → build → E2E → docs:check                                                                                       |
| Docs gate        | `npm run docs:check` (required docs, phase sections, changelog on PRs)                                                                                            |

## 4. Files added/changed

| Path                                                                                                     | Purpose                                                                  |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `app/[locale]/layout.tsx`                                                                                | Root layout per locale: `<html lang dir>`, fonts, providers, shell       |
| `app/[locale]/page.tsx`                                                                                  | Home page                                                                |
| `app/[locale]/design-system/page.tsx`                                                                    | Living design-system reference                                           |
| `app/[locale]/not-found.tsx`, `[...rest]/page.tsx`                                                       | Localized 404 for unknown paths                                          |
| `app/globals.css`                                                                                        | Design tokens and base styles                                            |
| `proxy.ts`                                                                                               | Locale negotiation and redirect (Next 16 "proxy", formerly middleware)   |
| `i18n/*`                                                                                                 | Locale list and metadata, routing, request config, navigation, key types |
| `messages/en.json`, `messages/hi.json`                                                                   | Translations                                                             |
| `components/providers.tsx`                                                                               | Theme, text direction, motion, tooltip and toast providers               |
| `components/shell/*`                                                                                     | Sidebar, bottom nav, top bar controls, nav config                        |
| `components/empty-state.tsx`, `data-table.tsx`, `motion.tsx`                                             | Shared building blocks                                                   |
| `components/ui/*`                                                                                        | shadcn/ui primitives                                                     |
| `features/design-system/*`                                                                               | Dialog/toast demo, languages table                                       |
| `lib/motion.ts`, `lib/utils.ts`                                                                          | Motion presets, `cn`                                                     |
| `tests/unit/*`, `tests/e2e/*`, `tests/setup.ts`                                                          | Tests                                                                    |
| `vitest.config.mts`, `playwright.config.ts`                                                              | Test runners                                                             |
| `eslint.config.mjs`, `.prettierrc.json`, `.lintstagedrc.json`, `.husky/pre-commit`                       | Code quality                                                             |
| `.github/workflows/ci.yml`                                                                               | Verification gate in CI                                                  |
| `scripts/docs-check.mjs`                                                                                 | Documentation gate                                                       |
| `docs/*`, `PROGRESS.md`, `README.md`                                                                     | Documentation                                                            |
| `.gitignore`, `.env.example`, `components.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs` | Configuration                                                            |

**Removed:** the entire previous implementation (`apps/`, `packages/`, `infrastructure/`, old
`docs/`, pnpm workspace files, Docker Compose). It is preserved in git under the tag `legacy-v1`.
The old `.env` was renamed to `.env.legacy` (git-ignored, unused) so Next.js does not load it.

## 5. Database changes

None. `supabase/migrations/` is created and empty; the data model is designed and approved at the
start of Phase 1.

## 6. Environment variables added

None.

## 7. How to test it

Automated:

```bash
npm run typecheck && npm run lint && npm run test && npm run build && npm run test:e2e && npm run docs:check
```

Manual: run `npm run dev`, open <http://localhost:3000>, and follow the **Manual QA checklist —
Phase 0** in [`TESTING.md`](../TESTING.md#manual-qa-checklist--phase-0).

## 8. Verification results

Run on 2026-10-15, Windows 11, Node 22.12.0:

| Check                  | Result                                                                   |
| ---------------------- | ------------------------------------------------------------------------ |
| `npm run typecheck`    | Pass, 0 errors                                                           |
| `npm run lint`         | Pass, 0 errors, 0 warnings                                               |
| `npm run format:check` | Pass                                                                     |
| `npm run test`         | Pass, 24/24 tests in 6 files                                             |
| `npm run build`        | Pass; `/en`, `/hi`, `/en/design-system`, `/hi/design-system` prerendered |
| `npm run test:e2e`     | Pass, 36/36 (desktop Chrome, Pixel 7, iPhone 14)                         |
| `npm run docs:check`   | Pass                                                                     |

## 9. Known limitations & follow-ups

- Profile menu shows a guest state and a disabled "Sign in" until authentication (Phase 1).
- The notifications panel always shows its empty state until notifications exist (Phase 5).
- Only two nav entries (Home, Design system); role-based entries arrive with their features.
- Node 22.12 keeps `jsdom` at 28.1 (ADR-007). Upgrading Node to the current LTS is recommended.
- `npm audit` reports a dev-only advisory (ADR-010).
- The repository is inside OneDrive; moving it out is recommended.
- The PWA (service worker, manifest) is Phase 10; `@serwist/next` is not installed yet.

## 10. Deviations from the plan

| Plan (`CLAUDE.md`)                         | What happened                                                     | Why                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Deploy an empty shell to Vercel in Phase 0 | Not done; deployment moves to Phase 12                            | Project owner's decision (ADR-008). CI runs the same production build on every push |
| Verify "Vercel preview URL loads"          | Replaced by `npm run build` + E2E against the production build    | Same reason                                                                         |
| Husky set up by the install                | Owner runs `npx husky` once                                       | Its install step runs a git command (ADR-009)                                       |
| Latest versions of every library           | TypeScript 6 (not 7), TanStack Table 8 (not 9), jsdom 28 (not 30) | Compatibility (ADR-005, 006, 007)                                                   |
| Framer Motion                              | `motion` package                                                  | Framer Motion's new name (ADR-003)                                                  |
