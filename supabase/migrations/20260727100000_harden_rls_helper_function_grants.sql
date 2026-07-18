-- Security hardening only — no function body, signature, search_path, RLS
-- predicate, or auth.uid() logic changes. Found during a full-codebase
-- security audit: these 6 SECURITY DEFINER helper functions are called
-- from inside RLS policies (which requires `authenticated` to hold EXECUTE
-- on them) but, unlike every other SECURITY DEFINER RPC in this schema,
-- never had an explicit `revoke`/`grant` pair — so PUBLIC (and therefore
-- `anon`) likely still held Postgres's default EXECUTE privilege on them.
-- Exploitability was low (each function scopes its own logic to
-- `auth.uid()`, so an anonymous caller learns nothing beyond `false`/
-- empty), but leaving internal policy-helper functions callable directly
-- as RPCs by anon violates this codebase's own least-privilege convention.
-- `anon` is deliberately NOT granted execute on any of these six — unlike
-- the two invitation-token-preview RPCs (`get_invitation_by_token`,
-- `get_client_invitation_by_token`), which must work pre-authentication
-- and already have their own correct `anon, authenticated` grant, left
-- untouched by this migration.

revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

revoke all on function public.has_workspace_role(uuid, text[]) from public;
grant execute on function public.has_workspace_role(uuid, text[]) to authenticated;

revoke all on function public.current_user_workspace_ids() from public;
grant execute on function public.current_user_workspace_ids() to authenticated;

revoke all on function public.has_permission(uuid, text) from public;
grant execute on function public.has_permission(uuid, text) to authenticated;

revoke all on function public.is_client_account_holder(uuid) from public;
grant execute on function public.is_client_account_holder(uuid) to authenticated;

revoke all on function public.is_client_account_holder_in_workspace(uuid, uuid) from public;
grant execute on function public.is_client_account_holder_in_workspace(uuid, uuid) to authenticated;
