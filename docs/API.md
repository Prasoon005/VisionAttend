# API

> **Status:** Phase 0 has no Server Actions, Route Handlers or RPCs.

From Phase 1 every server entry point is listed here with:

| Field       | Meaning                                                       |
| ----------- | ------------------------------------------------------------- |
| Name / path | Server Action name, Route Handler path or RPC function name   |
| Input       | zod schema (shared by client and server)                      |
| Output      | Success shape                                                 |
| Who         | Roles allowed (checked in the action **and** enforced by RLS) |
| Errors      | Error codes the caller can receive                            |
| Rate limit  | Upstash limit, if any                                         |

## Request pipeline

| Step               | File                                   | Behaviour                                                                                                                                           |
| ------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Locale negotiation | `proxy.ts`                             | Paths without a locale redirect to `/<locale>/…` (cookie → `Accept-Language` → `en`)                                                                |
| Session refresh    | `proxy.ts`, `lib/supabase/proxy.ts`    | `supabase.auth.getUser()` validates the token with the Auth server; renewed session cookies are written on the response                             |
| Sign-in gate       | `proxy.ts`, `lib/auth/route-access.ts` | Signed-out requests to `/dashboard`, `/settings` → `/<locale>/login?next=…`; to `/admin`, `/platform` → `/<locale>/admin/login?next=…`              |
| Role gate          | `lib/auth/session.ts` (`requireRole`)  | Each protected page checks the live profile: wrong role → that role's home; deactivated, deleted or suspended org → `/login?error=account_inactive` |
| Excluded paths     | `proxy.ts`                             | `/api/*`, `/_next/*`, `/_vercel/*` and files with an extension skip the proxy                                                                       |

### Who may open which area

| Area         | Roles                      | Home for        |
| ------------ | -------------------------- | --------------- |
| `/platform`  | Super Admin                | Super Admin     |
| `/admin`     | Org Admin                  | Org Admin       |
| `/dashboard` | Org Admin, Manager, Member | Manager, Member |
| `/settings`  | Everyone signed in         | (from slice 1h) |

`next` is validated by `safeNextPath()` so it can only point inside the app (no open redirects).
