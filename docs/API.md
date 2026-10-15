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

## Request pipeline (built in Phase 0)

| Step               | File       | Behaviour                                                                            |
| ------------------ | ---------- | ------------------------------------------------------------------------------------ |
| Locale negotiation | `proxy.ts` | Paths without a locale redirect to `/<locale>/…` (cookie → `Accept-Language` → `en`) |
| Excluded paths     | `proxy.ts` | `/api/*`, `/_next/*`, `/_vercel/*` and files with an extension skip the proxy        |
