-- Final pass of the SECURITY DEFINER privilege-hardening series started in
-- 20260727100000/20260727100100. Grants only — no function body, signature,
-- search_path, RLS predicate, or auth.uid() logic is touched anywhere in
-- this file. See docs/permissions.md for the full audit and classification.
--
-- Category A — trigger-only functions (never intended to be callable
-- through RPC by anyone). All four `returns trigger`, so the invoking
-- role's EXECUTE privilege is irrelevant to whether the trigger itself
-- fires — Postgres invokes a trigger function directly, independent of the
-- normal statement-level privilege check. Locking these down to zero
-- direct callers is pure hardening with no functional effect.

revoke all on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

revoke all on function public.protect_workspace_owners() from public;
revoke execute on function public.protect_workspace_owners() from anon;
revoke execute on function public.protect_workspace_owners() from authenticated;

revoke all on function public.validate_client_account_action_authority() from public;
revoke execute on function public.validate_client_account_action_authority() from anon;
revoke execute on function public.validate_client_account_action_authority() from authenticated;

revoke all on function public.validate_invitation_role_authority() from public;
revoke execute on function public.validate_invitation_role_authority() from anon;
revoke execute on function public.validate_invitation_role_authority() from authenticated;

-- Category B — authenticated-only RPCs that this project's schema-level
-- default privileges (see prior migrations' comments) had silently
-- re-granted to `anon` despite each already having its own explicit
-- `grant execute ... to authenticated` (never `anon`). Every one of these
-- requires an already-signed-in caller (accept_*_invitation validates the
-- caller's own profile email; the others read/write the caller's own
-- auth.uid()-scoped row) — anon calling any of them either errors or
-- returns nothing meaningful, but removing the access is still the
-- correct least-privilege state. `authenticated` is left untouched.

revoke execute on function public.accept_workspace_invitation(text) from anon;
revoke execute on function public.accept_client_invitation(text) from anon;
revoke execute on function public.get_current_client_account_context() from anon;
revoke execute on function public.touch_client_account_last_access() from anon;
revoke execute on function public.get_client_document_storage_ref(uuid) from anon;

-- Category C (get_invitation_by_token, get_client_invitation_by_token) and
-- the 6 RLS-helper functions hardened in the prior two migrations are
-- already correct and are not touched by this migration.
