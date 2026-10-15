# VisionAttend

Facial-recognition attendance and workforce platform for colleges, offices and factories. It runs
on free tiers (Vercel + Supabase), works well on phones, speaks multiple languages and supports
voice.

> **Status:** Phase 0 (foundation) is complete. Feature phases follow `CLAUDE.md`; progress is in
> [`PROGRESS.md`](PROGRESS.md).

## Features available now

- Responsive app shell: sidebar on desktop, bottom navigation on phones.
- English and हिन्दी, switchable on any page, with language-specific URLs.
- Light, dark and system themes.
- Design system reference page (`/en/design-system`).

## Planned

Face enrollment with explicit consent · face check-in on phone or kiosk with liveness checks · voice
greetings and commands · leave and regularization requests · admin console with live dashboard and
reports · feedback tickets · emergency roll call · offline kiosk · PWA.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Motion · next-intl · Vitest ·
Playwright. Supabase (Postgres, Auth, RLS, pgvector), Upstash and in-browser face AI join in later
phases. Reasons for each choice: [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Quick start

```bash
npm install
npx husky                              # enable the pre-commit hook (once)
npm run dev                            # http://localhost:3000
```

Full setup, commands and environment variables: [`docs/SETUP.md`](docs/SETUP.md). All
documentation: [`docs/README.md`](docs/README.md).
