# Database

> **Status:** no tables yet. `supabase/migrations/` is empty after Phase 0.

The data model is designed at the start of **Phase 1** and needs approval before any migration is
written (`CLAUDE.md` §3 and Rule 6). This document will then list every table, column, relation and
Row Level Security policy, with a Mermaid ER diagram.

## Planned entities (from `CLAUDE.md` §3, to be refined in Phase 1)

`organizations`, `profiles`, `departments`, `locations`, `shifts`, `user_shifts`,
`face_enrollments`, `attendance_records`, `kiosks`, `leave_requests`, `regularization_requests`,
`feedback_tickets`, `ticket_messages`, `announcements`, `notifications`, `audit_logs`, `consents`,
`invites`.

## Principles carried over from the previous implementation (`legacy-v1`)

These proved themselves in the earlier version and will be proposed for the Phase 1 model:

| Principle                                                                      | Why                                                                        |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Every tenant-owned table has `org_id`, and RLS scopes rows to it               | One organization can never read another's data, even if app code has a bug |
| Composite foreign keys `(org_id, id)`                                          | A row can never point at a row of another organization                     |
| Times stored as `timestamptz` (UTC); work dates computed in the org's timezone | Correct late/early calculation across time zones                           |
| Shift times as minutes after local midnight; end ≤ start means overnight       | Overnight shifts stay simple and testable                                  |
| Audit rows written in the same transaction as the change                       | The audit trail cannot miss or invent changes                              |
| `CHECK` constraints for invariants (ranges, scores 0–1)                        | The last line of defence if validation has a bug                           |
