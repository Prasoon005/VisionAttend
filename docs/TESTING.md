# Testing

## Verification gate

A phase is complete only when all of these pass (`CLAUDE.md` §0.4). CI runs them on every push and
pull request (`.github/workflows/ci.yml`).

```bash
npx supabase start   # once; the database tests need the local stack
npm run typecheck && npm run lint && npm run test && npm run test:db && npm run build && npm run test:e2e && npm run docs:check
```

## Suites

### Unit — Vitest + Testing Library (`tests/unit/`)

Runs in jsdom. `npm run test` (or `npm run test:watch`).

| File                    | Covers                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `i18n-messages.test.ts` | Every locale has the same keys and `{placeholders}` as English, with no empty strings                       |
| `locales.test.ts`       | Locale list, default locale, text direction, always-prefixed URLs                                           |
| `nav-items.test.ts`     | Active-link matching; translated labels; role-filtered entries; no link to an area the role can't open      |
| `route-access.test.ts`  | Which roles may open which area; guest-only sign-in pages; role homes; `safeNextPath` blocks open redirects |
| `empty-state.test.tsx`  | EmptyState renders title, description and action                                                            |
| `data-table.test.tsx`   | Rows, empty state, opt-in sorting (ascending → descending, `aria-sort`)                                     |
| `docs-check.test.ts`    | The `docs:check` rules and its exit code                                                                    |

### Database — Vitest against local Supabase (`tests/db/`)

`npm run test:db`, with `npx supabase start` running. Global setup reads the URL and keys from
`supabase status`. Tests sign in as **real users**, created through real invitations, and prove what
each role can do. Each file creates its own uniquely named organizations, so runs never interfere.

| File                      | Covers                                                                                                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rls.test.ts`             | Who sees which profiles (member / manager / org admin / super admin); self-edit limited to personal columns; no cross-org reads or writes; suspended orgs lose access; audit logs append-only; anonymous visitors see nothing |
| `invites.test.ts`         | Sign-up refused without an invite; the invite sets org, role and department; expired / revoked / wrong-email / used-up / suspended-org invites refused; token not kept in metadata; who may create and revoke invites         |
| `admin-functions.test.ts` | Role and department changes, deactivation (access ends immediately), soft delete, audit rows, last-admin protection, cross-org targets treated as not found                                                                   |

### End-to-end — Playwright (`tests/e2e/`)

Runs against a **production build** on port 3100, in three projects:

| Project            | Device                  | Engine   |
| ------------------ | ----------------------- | -------- |
| `desktop-chrome`   | Desktop Chrome 1280×720 | Chromium |
| `mobile-pixel-7`   | Pixel 7                 | Chromium |
| `mobile-iphone-14` | iPhone 14               | WebKit   |

`auth-guard.spec.ts` covers: signed-out visitors redirected from `/dashboard`, `/admin`, `/platform` to the right sign-in page with `next` kept; public pages stay reachable.

`shell.spec.ts` covers: redirect to the default locale; sidebar on desktop and bottom bar on phones;
no horizontal scroll; navigation with `aria-current`; switching to Hindi on the same page; dark theme
persisting across reloads; notifications empty state; no browser console errors (incl. hydration) on any page; localized 404 with HTTP status 404; dialog
open/close with Escape; toast; data table rows.

Useful commands: `npx playwright test --project=mobile-iphone-14`, `npx playwright test --ui`,
`npx playwright show-report`.

## Manual QA checklist — Phase 0

Things automation can't judge well:

- [ ] Home and Design system pages look polished in **light** and **dark** themes (contrast, no harsh colors).
- [ ] Switching theme causes no white flash on reload.
- [ ] Hindi text renders with the Devanagari font (no boxes or fallback glyphs), on desktop and phone.
- [ ] On a real phone (or DevTools device mode at 360 px): bottom bar is reachable by thumb, clears the iOS home indicator, and no content hides behind it.
- [ ] Home feature cards animate in once. With OS "reduce motion" enabled, they don't slide.
- [ ] Keyboard only: Tab reaches "Skip to content" first; all top-bar menus open with Enter/Space and close with Escape; focus is always visible.
- [ ] Screen reader (NVDA or VoiceOver): nav landmarks are announced; icon buttons have names (Change language, Change theme, Notifications, Profile menu).
