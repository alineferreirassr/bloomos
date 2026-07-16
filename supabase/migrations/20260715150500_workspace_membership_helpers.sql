-- Supabase Foundation — migration 6 of 8: Workspace membership helper functions.
--
-- security definer is used deliberately here, and only here: without it,
-- evaluating these functions from inside a workspace_members RLS policy
-- would recurse into workspace_members' own RLS to answer the membership
-- question, which either fails or silently returns no rows. `set search_path
-- = public` is pinned on every one of them (a security definer function
-- with a mutable search_path is a well-known Postgres privilege-escalation
-- vector — see https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
-- All three are `stable`, not `volatile` — they only read, matching the
-- planner's expectations for use inside a policy.

create or replace function public.is_workspace_member(workspace_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = workspace_uuid
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

comment on function public.is_workspace_member(uuid) is
  'True iff the current auth.uid() has an active membership in the given Workspace. Suspended/invited members return false.';

create or replace function public.has_workspace_role(workspace_uuid uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = workspace_uuid
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any (allowed_roles)
  );
$$;

comment on function public.has_workspace_role(uuid, text[]) is
  'True iff the current auth.uid() has an active membership in the given Workspace with a role in allowed_roles.';

create or replace function public.current_user_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.workspace_id
  from public.workspace_members m
  where m.user_id = auth.uid()
    and m.status = 'active';
$$;

comment on function public.current_user_workspace_ids() is
  'Every Workspace id the current auth.uid() has an active membership in.';
