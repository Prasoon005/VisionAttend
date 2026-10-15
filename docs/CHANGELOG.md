# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
newest first.

## [Unreleased]

## [0.1.0] — 2026-10-15 — Phase 0: Project setup & foundation

The project was rebuilt from scratch on Next.js + Supabase following `CLAUDE.md`. The previous
Express/Prisma/Vite implementation is preserved under the git tag `legacy-v1`.

### Added

- Next.js 16 (App Router) app with strict TypeScript, Tailwind CSS 4 and shadcn/ui (Radix, RTL-aware).
- Design system: OKLCH color tokens (brand indigo plus success and warning), light/dark/system
  themes, Geist plus Noto Sans Devanagari fonts, motion presets that respect reduced-motion
  settings.
- Shared components: Button, Card, Badge (incl. success/warning), Dialog, Toast, Skeleton,
  EmptyState, a sortable DataTable, dropdown menus, popovers, tooltips.
- Responsive app shell: desktop sidebar, mobile bottom bar (safe-area aware), and a top bar with
  language switcher, theme toggle, notifications panel and profile menu.
- Internationalization with `next-intl`: English and Hindi, locale-prefixed URLs (`/en`, `/hi`),
  type-checked translation keys, layout ready for right-to-left languages.
- Pages: home (`/[locale]`), design system reference (`/[locale]/design-system`), localized 404.
- Tooling: ESLint, Prettier (Tailwind class sorting), Husky + lint-staged pre-commit hook.
- Tests: Vitest + Testing Library (24 unit tests); Playwright on desktop Chrome, Pixel 7 and
  iPhone 14 (36 E2E tests).
- GitHub Actions CI running the full verification gate plus `docs:check`.
- Documentation skeleton (`docs/`), `PROGRESS.md`, and `scripts/docs-check.mjs`.
