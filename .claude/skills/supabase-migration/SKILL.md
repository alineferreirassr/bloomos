---
name: supabase-migration
description: Propose, get approval for, and apply Supabase migrations to the linked BloomOS project — the standing migration-approval protocol used for every schema/RLS change in this repo. Use whenever migrations exist that haven't been pushed, the user asks to apply/push migrations, or any work is about to touch supabase/migrations/ and the live database. Never runs a remote/destructive command without explicit approval — this is the one skill most focused on that boundary.
---

# Supabase migration

The standing protocol for getting a schema change from a local `.sql` file onto the live, linked Supabase project — used without exception for every migration in this repo's history. The entire point of this skill is the approval gate in step 4; nothing after it runs without an explicit yes.

## Procedure

1. **List the exact pending migrations** — run `npx supabase migration list` and report precisely which files are local-only (not yet on remote), never "some migrations" vaguely.
2. **Explain what each migration creates** — tables/columns/constraints/indexes/triggers/RLS policies/functions, in plain terms, plus why each change is safe (what it does and doesn't touch).
3. **Confirm no unrelated tables are affected** — read the migration file(s) again specifically looking for anything outside the stated scope.
4. **Wait for explicit approval before any remote push.** Present the exact SQL and the summary from steps 1–3, then stop and wait for a clear yes. No exceptions, no "since this is obviously safe."
5. Once approved, apply with `npx supabase db push` against the linked project only — never construct or paste in a project URL/anon key, never link a different project.
6. **Verify Local ↔ Remote history** — `npx supabase migration list` again, confirm every entry matches and nothing is partial.
7. **Verify the actual schema landed correctly** — tables, columns, indexes, constraints, triggers, RLS enablement, policies, functions, and that pre-existing Foundation objects (`is_workspace_member()`, etc.) are untouched. Read-only SQL queries against the linked project (`npx supabase db query --linked`) are the way to do this — never trust the migration file alone as proof of what's live.
8. **Confirm no sample/seed data was inserted** unless the user explicitly asked for it.
9. Run `verification` (lint → typecheck → test → build) locally.
10. Commit only after every check in this list has actually passed.

## Never run without explicit, in-the-moment approval

- `supabase db reset`
- Any destructive SQL (`drop table`, `truncate`, an `update`/`delete` without a `where` a human has reviewed)
- Remote migration repair or history mutation (`supabase migration repair`)
- Anything that would alter project-wide default privileges, RLS on an unrelated table, or a grant broader than what was explicitly requested

If a live investigation surfaces an unexpected finding (e.g. a privilege leak, a stale assumption about what's already live), stop and report it rather than silently working around it — this has been the single most valuable thing this protocol catches in practice.
