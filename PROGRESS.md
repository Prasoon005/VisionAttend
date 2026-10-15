# Progress

Current phase: **Phase 1 — Authentication & account management: in progress** (slice 1a done).
Next: **slice 1b — Supabase clients and session handling**.

| Phase | Theme                                  | Status      |
| ----- | -------------------------------------- | ----------- |
| 0     | Project setup & foundation             | Complete    |
| 1     | Authentication & account management    | In Progress |
| 2     | Face enrollment                        | Planned     |
| 3     | Face attendance (check-in / check-out) | Planned     |
| 4     | Voice features                         | Planned     |
| 5     | Member experience                      | Planned     |
| 6     | Admin console                          | Planned     |
| 7     | Feedback & support                     | Planned     |
| 8     | Differentiating features               | Planned     |
| 9     | Multi-language completion              | Planned     |
| 10    | Mobile & PWA polish                    | Planned     |
| 11    | Security & privacy hardening           | Planned     |
| 12    | Deployment & documentation             | Planned     |

## Phase 0

**Done:** Next.js 16 + TypeScript strict, Tailwind 4 + shadcn/ui, design tokens and themes, motion
presets, shared components, responsive shell (sidebar, bottom bar, top bar), English + Hindi with
`next-intl`, Vitest (24 tests), Playwright on 3 devices (36 tests), CI workflow, docs skeleton and
`docs:check`. Details: [`docs/phases/phase-00-foundation.md`](docs/phases/phase-00-foundation.md).

**Pending (owner actions):**

- [ ] Run `npx husky` once to enable the pre-commit hook.
- [ ] Push the `rebuild` branch and confirm the CI workflow passes on GitHub.
- [ ] Recommended: upgrade Node.js to the current LTS; move the repo out of OneDrive.

**Known issues:** dev-only `npm audit` advisory (ADR-010); Node 22.12 keeps `jsdom` at 28.1 (ADR-007).

### Manual tests to run

See the checklist in [`docs/TESTING.md`](docs/TESTING.md#manual-qa-checklist--phase-0): themes,
Hindi font rendering, phone layout and safe area, reduced motion, keyboard and screen reader.

## Phase 1 (in progress)

Plan and slice status: [`docs/phases/phase-01-auth.md`](docs/phases/phase-01-auth.md).

**Slice 1a done:** schema, RLS, admin functions, invite-only sign-up, seed, 54 database tests.

**Manual tests for 1a:**

- [ ] `npx supabase db reset`, then open Studio (<http://127.0.0.1:54323>): Demo College, 3 departments and 5 profiles exist.
- [ ] In Studio's SQL editor, `update audit_logs set action = 'x.y'` fails with "append-only".
