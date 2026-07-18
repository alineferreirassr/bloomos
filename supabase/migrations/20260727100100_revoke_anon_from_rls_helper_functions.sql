-- Follow-up to 20260727100000_harden_rls_helper_function_grants.sql.
--
-- That migration's `revoke all on function ... from public` did not remove
-- `anon`'s access to these 6 functions, because this project's schema-level
-- default privileges (`alter default privileges in schema public grant
-- execute on functions to anon, authenticated`, set at project provisioning
-- by `postgres`/`supabase_admin` — confirmed via `pg_default_acl`) grant
-- `anon` a direct, role-specific EXECUTE privilege at function-creation
-- time, entirely separate from PUBLIC's own privilege. Revoking PUBLIC's
-- grant never touches that separate, already-existing `anon` grant.
--
-- This migration closes that gap with an explicit, targeted revoke against
-- `anon` for exactly these 6 functions — the same 6 hardened in the prior
-- migration, no others. It does not touch `authenticated` (still granted),
-- does not re-touch PUBLIC (already revoked), and does not alter this
-- project's default-privilege configuration itself — that configuration
-- still applies to every other/future function in this schema, unchanged,
-- exactly as instructed.

revoke execute on function public.is_workspace_member(uuid) from anon;
revoke execute on function public.has_workspace_role(uuid, text[]) from anon;
revoke execute on function public.current_user_workspace_ids() from anon;
revoke execute on function public.has_permission(uuid, text) from anon;
revoke execute on function public.is_client_account_holder(uuid) from anon;
revoke execute on function public.is_client_account_holder_in_workspace(uuid, uuid) from anon;
