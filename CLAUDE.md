# VisionAttend — Master Build Plan for Claude Code

You are the lead full-stack engineer building **VisionAttend**, a production-quality, facial-recognition attendance and workforce platform for organizations (colleges, offices, factories). It must deploy on **free tiers** (Vercel or Netlify + Supabase), work well on **mobile**, support **multiple languages**, include **voice features**, and have a **polished, dynamic UI**.

Build it **phase by phase**. Never start a new phase until the current one passes every verification step below.

---

## 0. Working Rules (follow these in every session)

1. **Plan first.** At the start of each phase, write a short plan (files to create, DB changes, risks) and wait for my "go" before writing code.
2. **I handle ALL git operations myself. You must NEVER run any git command.** That means no `git add`, `git commit`, `git push`, `git pull`, `git checkout`, `git branch`, `git merge`, `git rebase`, `git stash`, `git reset`, `git tag`, or `gh` CLI commands, and no `vercel --prod` / `netlify deploy` that bypasses my git flow. Read-only `git status` and `git diff` are allowed only to write an accurate commit message.
   - After **every function / sub-feature** you create or finish (once it works and its tests pass), **stop and suggest a commit** in this exact format, then wait for me to say I've committed before continuing:

     ```
     ✅ Ready to commit
     Files changed:
       - path/to/file1.ts   (new | modified | deleted)
       - path/to/file2.tsx  (modified)
     Suggested commit message:
       feat(auth): add email login with role-based redirect

       - Supabase email/password sign-in via server action
       - Redirect admins to /admin, members to /dashboard
       - Rate limit: 5 attempts per 15 min per IP
     ```
   - Use Conventional Commits: `feat`, `fix`, `docs`, `test`, `refactor`, `style`, `chore`, `perf`, `ci`, with a scope (`auth`, `face`, `kiosk`, `voice`, `admin`, `feedback`, `i18n`, `pwa`, `db`, `docs`…). Subject line under 72 characters, imperative mood ("add", not "added").
   - Keep each suggested commit small and focused on one function or sub-feature. If changes are unrelated, suggest separate commits and say which files go in each.
   - If something must happen in git (new branch for a phase, a tag at phase completion, pushing to trigger a Vercel deploy), **tell me the exact command to run** instead of running it.
3. **Track progress** in `PROGRESS.md`: phase, what's done, what's pending, known issues, and the manual tests I should run.
4. **Verification gate (mandatory before closing a phase):**
   - `npm run typecheck` passes with zero errors
   - `npm run lint` passes
   - `npm run test` (Vitest unit tests) passes
   - `npm run test:e2e` (Playwright) passes for that phase's flows, including a mobile viewport (Pixel 7 / iPhone 14)
   - `npm run build` succeeds (production build, same as Vercel)
   - Write a manual QA checklist in `PROGRESS.md` for things that can't be automated (camera, microphone).
   - **Documentation is updated** as described in Section 0.1 below. A phase is NOT complete if its docs are missing or stale.
5. **Never hardcode secrets.** Use `.env.local` and keep `.env.example` updated.
6. **Ask, don't guess**, when a requirement is ambiguous or a decision is expensive to reverse (schema, auth model, libraries).
7. **No placeholder code** left behind: no `TODO: implement`, no fake data in production paths. Seed data goes in `supabase/seed.sql` only.
8. **Explain what I need to do manually** (create Supabase project, add env vars on Vercel, etc.) as clear numbered steps.
9. If something fails, find the root cause, fix it, and re-run the full verification gate. Don't silence errors or skip tests.

---

## 0.1 Documentation Rules (mandatory, every section)

Keep a living `docs/` folder that always matches the current code. Update it **when you start a section** (planned scope) and **when you complete a section** (what was actually built). Include the docs changes in the commit you suggest for that code, or suggest a separate `docs:` commit right after it (I run the git commands, see Rule 2). Never batch docs for "later".

**Folder structure (create in Phase 0):**

```
docs/
  README.md              ← index linking every doc below
  CHANGELOG.md           ← dated entries, newest first (Keep a Changelog format)
  ARCHITECTURE.md        ← system overview + Mermaid diagrams (data flow, face pipeline, auth flow)
  DATABASE.md            ← every table, columns, relations, RLS policies, ER diagram (Mermaid)
  API.md                 ← every Server Action / Route Handler / RPC: input, output, who can call it, errors
  DECISIONS.md           ← Architecture Decision Records: what was chosen, alternatives, why
  SETUP.md               ← local setup, env vars, Supabase + Vercel/Netlify deploy steps
  TESTING.md             ← how to run tests, what each suite covers, manual QA checklists
  USER_GUIDE.md          ← how members use the app (with screenshots where helpful)
  ADMIN_GUIDE.md         ← how admins manage org, users, kiosks, tickets, reports
  TROUBLESHOOTING.md     ← known issues and fixes (camera permission, voice not supported, etc.)
  phases/
    phase-00-foundation.md
    phase-01-auth.md
    ...one file per phase
```

**Each `docs/phases/phase-XX-*.md` must contain:**
1. **Goal**: what this phase delivers.
2. **Status**: Planned / In Progress / Complete, with dates.
3. **Features built**: list with a one-line description each.
4. **Files added/changed**: key paths and what they do.
5. **Database changes**: migration file names and what they changed.
6. **Environment variables added** (names only, never values).
7. **How to test it**: automated test commands + manual QA steps.
8. **Verification results**: typecheck / lint / unit / e2e / build outcomes, with test counts.
9. **Known limitations & follow-ups.**
10. **Deviations from the plan** and why.

**When a section is completed, also:**
- Add a `CHANGELOG.md` entry.
- Update every cross-cutting doc it affects (`DATABASE.md` for schema, `API.md` for new endpoints, `ARCHITECTURE.md` if the design changed, user/admin guides for new screens, `SETUP.md` for new env vars or services).
- Add an ADR to `DECISIONS.md` for any library choice or design trade-off.
- Update `PROGRESS.md` and the root `README.md` feature list.
- Finish by printing a short summary to me: "Docs updated: [list of files]".

**Docs quality rules:**
- Write for a new developer (or an examiner reading the project) who has never seen the code.
- Docs must match the code exactly. If you change code from an earlier phase, update that phase's doc and the related cross-cutting docs too.
- Prefer Mermaid diagrams and tables over long paragraphs.
- Add a CI check (`npm run docs:check`) that fails if a phase is marked Complete but its phase doc is missing required headings, or if `CHANGELOG.md` wasn't touched in a PR that changes `app/`, `features/` or `supabase/migrations/`.

---

## 1. Tech Stack (fixed unless I approve a change)

| Area | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript (strict) | Native to Vercel |
| UI | Tailwind CSS + shadcn/ui + Framer Motion + lucide-react | Polished, accessible, animated |
| Backend / DB | Supabase (Postgres, Auth, Storage, Realtime, `pgvector`) | Generous free tier, Row Level Security |
| Face AI | `@vladmandic/human` (or `@vladmandic/face-api`), runs **in the browser** | Serverless functions can't run heavy ML; client-side keeps it free and fast |
| Vector matching | `pgvector` in Supabase via an RPC function | Fast nearest-neighbour face matching on the server |
| i18n | `next-intl` | Locale routing, RTL support |
| Voice | Web Speech API (`SpeechSynthesis` + `SpeechRecognition`), with graceful fallback | Free, built into browsers |
| Forms / validation | react-hook-form + zod (shared schemas client + server) | |
| Charts | Recharts | |
| Data fetching | TanStack Query | Caching, offline-friendly |
| Rate limiting | Upstash Redis (free tier) | Protect auth and check-in endpoints |
| PWA | `@serwist/next` (or `next-pwa`) | Installable on mobile, offline queue |
| Email | Supabase Auth emails (+ Resend free tier for custom mail, optional) | |
| Testing | Vitest + Testing Library + Playwright | |
| Deploy | Vercel (primary), Netlify-compatible config | |

**Important architecture constraint:** face detection, liveness, and embedding extraction run **client-side**. Only the numeric face embedding (e.g. 128/512-float vector), never raw face photos by default, is sent to the server. Matching, attendance writes, and all authorization happen **server-side** (Server Actions / Route Handlers + RLS). The client is never trusted.

---

## 2. Roles & Permissions

- **Super Admin**: manages organizations, global settings.
- **Org Admin**: manages everything inside their organization: users, departments, shifts, locations, kiosks, feedback, reports.
- **Manager**: views and approves requests for their own team/department.
- **Member** (employee/student): enrolls face, marks attendance, views own records, submits requests and feedback.
- **Kiosk Device**: a special restricted session for a shared tablet at the entrance. Can only run check-in, nothing else.

Enforce roles in three layers: middleware (route protection), server actions (permission checks), and Postgres **Row Level Security** (final authority). Write tests proving a Member cannot read another member's data or call admin actions.

---

## 3. Core Data Model (refine in Phase 1, get my approval)

`organizations`, `profiles` (user_id, org_id, role, department_id, preferred_language, avatar), `departments`, `locations` (geofence lat/lng/radius), `shifts`, `user_shifts`, `face_enrollments` (user_id, embedding vector, quality_score, model_version, created_at), `attendance_records` (user_id, type in/out, timestamp, method face/qr/manual, confidence, liveness_passed, location, device_id, status on-time/late/flagged), `kiosks`, `leave_requests`, `regularization_requests` (fix a missed punch), `feedback_tickets` + `ticket_messages`, `announcements`, `notifications`, `audit_logs`, `consents` (biometric consent with timestamp + version), `invites`.

All tables have `org_id` and RLS policies scoped to it (multi-tenant).

---

## 4. Build Phases

### Phase 0 — Project Setup & Foundation
- Initialize Next.js + TS strict + Tailwind + shadcn/ui + ESLint + Prettier + Husky pre-commit.
- Folder structure: `app/[locale]/...`, `components/`, `lib/`, `features/<feature>/`, `supabase/migrations/`, `tests/`.
- Design system: color tokens, light/dark/system theme, typography scale, spacing, motion presets, reusable components (Button, Card, Dialog, DataTable, EmptyState, Skeleton, Toast).
- App shell: responsive sidebar (desktop) + bottom navigation (mobile), top bar with language switcher, theme toggle, notifications bell, profile menu.
- i18n scaffolding with `next-intl`: English, Hindi to start; architecture ready for more (including RTL like Arabic/Urdu). **Every user-facing string goes through translation files from day one.**
- Set up Vitest, Playwright (desktop + mobile projects), GitHub Actions CI running the verification gate.
- Create the full `docs/` skeleton from Section 0.1 (all files with headings), plus the `docs:check` script in CI.
- Guide me to deploy an empty shell to Vercel (I push to GitHub and connect the repo; you give me the exact steps and commands) to confirm the pipeline works.
- **Verify:** gate passes, Vercel preview URL loads, theme and language switching work on mobile viewport.

### Phase 1 — Authentication & Account Management
- Supabase Auth: email + password, magic link, Google OAuth (optional), email verification, forgot/reset password.
- Separate, clearly styled **Admin login** and **User login** entry points; role-based redirect after login.
- Proper logout (clears session on server and client, revokes refresh token), "log out of all devices".
- Session handling with `@supabase/ssr`: middleware refresh, protected routes, auto-redirect when expired.
- Organization onboarding: Super Admin/Org Admin creates org → invites users by email or invite code/link → user sets password and profile.
- Admin account management: list, search, filter, invite, edit role/department, deactivate/reactivate, reset password, delete (with confirmation and soft-delete).
- User profile & settings: name, avatar, language, theme, notification preferences, change password, delete my account / download my data.
- Security: rate limit login (Upstash), lockout after repeated failures, password strength meter, audit log for every auth and admin action.
- **Verify:** E2E tests for signup → verify → login → logout, password reset, role redirects, member blocked from `/admin`, RLS tests for cross-org access.

### Phase 2 — Face Enrollment
- Explicit **biometric consent** screen (what's stored, why, retention, how to delete), stored in `consents`. Written with India's DPDP Act 2023 in mind.
- Guided enrollment wizard: camera permission help, live face-box overlay, real-time quality checks (lighting, blur, face size, single face only, looking straight), capture 3–5 angles (front, slight left, slight right).
- Extract embeddings client-side, send to server, store in `face_enrollments` with `model_version`. Reject duplicates (same face already enrolled to another account) and alert admin.
- Admin can approve/reject enrollments, request re-enrollment, delete biometric data.
- Lazy-load ML models only on face pages (keep initial bundle small); show a nice loading state; cache models with the service worker.
- **Verify:** unit tests for quality-check logic and embedding normalization; E2E with a fake camera stream (Playwright `--use-fake-device-for-media-stream` with a test video); manual QA checklist on a real phone.

### Phase 3 — Face Attendance (Check-in / Check-out)
- **Personal mode:** member opens app on their phone → liveness check → face match → attendance marked. Optional geofence check against `locations`.
- **Kiosk mode:** full-screen tablet view at the entrance, continuously detects faces, recognizes multiple people, greets each one, auto check-in/out, works hands-free.
- **Liveness / anti-spoofing:** random challenge (blink, turn head left/right, smile) chosen by the server with a one-time nonce, time-limited; detect static photos and screen replays where possible. Be honest in docs that browser liveness is a strong deterrent, not bank-grade.
- Matching server-side via a `pgvector` RPC with a configurable similarity threshold per org; log confidence for every attempt.
- Rules engine: shift windows, grace period, late/early/half-day calculation, prevent double check-in, auto check-out at shift end if forgotten (flagged).
- Fallbacks: QR code check-in, manual entry by admin (always audited).
- Big, satisfying feedback: success animation, sound, voice greeting, haptic vibration on mobile.
- **Verify:** unit tests for the rules engine (on-time, late, overnight shifts, time zones), E2E for personal and kiosk flows with fake media, rate-limit tests, audit log assertions.

### Phase 4 — Voice Features
- **Voice greetings** in the user's chosen language: "Good morning, Prasoon. You're checked in at 9:02." (SpeechSynthesis, pick a matching voice per locale.)
- **Voice commands** (where `SpeechRecognition` is supported; hide gracefully otherwise): "Mark my attendance", "Show my attendance this week", "Apply for leave tomorrow", "Open feedback", "Switch to Hindi", "Dark mode".
- Command parser with intent matching per language (keep it local and deterministic; no paid AI APIs required).
- Accessibility benefit: voice-guided enrollment and check-in for visually impaired users ("move closer", "turn slightly left").
- Kiosk announcements: "3 people checked in", "Please look at the camera".
- Settings: enable/disable voice, voice speed, voice selection.
- **Verify:** unit tests for the intent parser in every supported language; feature-detection fallback tested; manual QA on Chrome Android and Safari iOS.

### Phase 5 — Member Experience
- Dashboard: today's status, live clock, shift timer, this week/month summary, streak counter, upcoming holidays, announcements.
- Attendance history with calendar heatmap view and list view, filters, export my data (CSV/PDF).
- Requests: leave application, missed-punch regularization, shift swap. Track status in real time.
- Notifications center (in-app + optional web push), realtime via Supabase Realtime.
- **Verify:** E2E for each request type end-to-end, mobile layouts screenshot-tested.

### Phase 6 — Admin Console
- Live dashboard: who's in right now, late arrivals, absentees, realtime check-in feed, charts (daily trend, department comparison, punctuality).
- Management: departments, locations/geofences (with map picker using free OpenStreetMap/Leaflet), shifts and rosters, holidays, kiosks (register device, pair with code, revoke).
- Approvals inbox: leave, regularization, enrollments, with bulk actions.
- Reports: daily/monthly/custom, per user/department, export CSV/Excel/PDF, scheduled email reports (optional).
- Audit log viewer with filters.
- Org settings: match threshold, liveness strictness, grace period, working days, data retention period, enabled languages.
- **Verify:** RBAC tests for every admin action; report numbers cross-checked against seed data in tests.

### Phase 7 — Feedback & Support System (resolved by Admin)
- Members raise tickets: category (attendance error, face not recognized, technical issue, suggestion, complaint), priority, description, optional screenshot, **voice-to-text input**.
- Anonymous feedback option for suggestions/complaints.
- Admin ticket board: Kanban (Open → In Progress → Resolved → Closed) + table view, assign to admin/manager, internal notes, threaded replies, SLA timers, canned responses.
- Member gets realtime notification on reply/resolution and can rate the resolution (1–5 stars).
- Admin analytics: average resolution time, satisfaction score, common issues.
- **Verify:** E2E for full ticket lifecycle, anonymous tickets don't leak identity (test it), notifications fire.

### Phase 8 — Unique / Differentiating Features
Implement these, prioritizing in this order, and ask me before dropping any:
1. **Emergency roll call:** one tap by admin during a fire drill/emergency shows everyone currently checked in, and each person can mark "I'm safe" from their phone. Live headcount.
2. **Buddy-punching & anomaly detection:** flag the same face on two devices at once, check-ins from impossible locations, low-confidence patterns, unusual hours. Show in an admin "Insights" panel.
3. **Offline-first kiosk:** if internet drops, queue check-ins securely in IndexedDB and sync when back online, with conflict handling.
4. **Smart insights:** plain-language weekly summaries ("Your punctuality improved 12% this week"), department trends, late-arrival patterns by weekday. Computed with SQL, no paid AI needed.
5. **Visitor mode:** register a visitor at the kiosk with a temporary pass and auto-expiring face record (deleted after the visit).
6. **Gamification (optional per org):** punctuality streaks, badges, monthly leaderboard (can be disabled for privacy).
7. **Command palette** (Ctrl/Cmd + K) for power users and admins.
8. **Privacy dashboard** for members: see exactly what biometric data exists, when it was used, and delete it.
- **Verify:** each feature has tests; offline sync tested by toggling network in Playwright.

### Phase 9 — Multi-language Completion
- Complete translations: English, Hindi, plus at least 3 more (suggested: Bengali, Tamil, Spanish, Arabic for RTL testing). Locale-aware dates, times, numbers.
- RTL layout fully working.
- Script to detect missing translation keys; CI fails if any key is missing.
- Voice features use the matching locale.
- **Verify:** Playwright runs core flows in every locale; RTL screenshot test.

### Phase 10 — Mobile & PWA Polish
- Installable PWA: manifest, icons, splash screens, offline fallback page, "Add to Home Screen" prompt.
- Mobile-first touches: bottom nav, swipe gestures, pull-to-refresh, large tap targets, safe-area insets, haptics, camera works in portrait.
- Performance: Lighthouse score ≥ 90 for Performance, Accessibility, Best Practices, SEO on mobile. Code-split ML models, optimize images, avoid layout shift.
- Accessibility: WCAG 2.1 AA, keyboard navigation, screen-reader labels, reduced-motion support.
- **Verify:** Lighthouse CI in GitHub Actions, axe accessibility tests in Playwright, manual test on a real Android and iPhone.

### Phase 11 — Security & Privacy Hardening
- Review every RLS policy; add tests for each table.
- Security headers + Content Security Policy (allow camera only on needed pages), CSRF protection on mutations, input validation with zod everywhere.
- Encrypt face embeddings at rest (Postgres pgcrypto or application-level), never log embeddings.
- Data retention job: auto-delete biometric data of deactivated users after the org's retention period (Supabase cron / pg_cron).
- Dependency audit (`npm audit`), secret scan.
- Write `SECURITY.md` and a plain-language privacy policy page.
- **Verify:** security test suite passes; manual pen-test checklist in `PROGRESS.md`.

### Phase 12 — Deployment & Documentation
- Production deploy on **Vercel** (also provide `netlify.toml` and confirm a Netlify build works locally). Give me the exact git and dashboard steps; I run them myself.
- Environment variables documented; Supabase migrations applied via CLI; seed a demo org with demo accounts (admin + member) for showcasing.
- Note free-tier limits in the README (e.g. Supabase free projects pause after inactivity; Vercel function limits) and how to keep the demo alive.
- `README.md`: features, screenshots/GIFs, architecture diagram (Mermaid), setup guide, tech decisions, demo credentials.
- Final full regression: run the entire test suite against the production URL.
- **Verify:** production URL works end-to-end on desktop and mobile; all tests green.

---

## 5. UI / UX Quality Bar
- Modern, premium look: clean layouts, glassmorphism or soft-depth cards used tastefully, smooth page transitions, micro-interactions on every action, skeleton loaders (never blank screens), helpful empty states with illustrations, friendly error messages with a retry action.
- Consistent spacing and typography; dark mode looks as good as light mode.
- The face-scan screen should feel special: animated scanning ring, real-time guidance text, success burst animation.
- Every screen designed for 360px-wide phones first, then tablet and desktop.

## 6. Definition of Done (for the whole project)
- All phases complete and verification gates passed.
- No TypeScript `any` without justification, no console errors in the browser.
- Works on latest Chrome, Edge, Firefox, Safari (desktop + mobile), with graceful fallbacks where voice APIs aren't supported.
- Deployed on a free tier, demo accounts work, README complete.
- Every phase has a complete doc in `docs/phases/`, and all cross-cutting docs match the final code.

---

**Start now with Phase 0.** First show me your plan for Phase 0 and the list of manual steps I'll need to do (accounts to create, keys to copy). Wait for my approval before writing code.
