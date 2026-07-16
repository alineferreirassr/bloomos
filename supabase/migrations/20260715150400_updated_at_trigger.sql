-- Supabase Foundation — migration 5 of 8: shared updated_at trigger.
--
-- One generic trigger function reused by every table below (and every
-- future table) instead of a bespoke function per table.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic BEFORE UPDATE trigger: stamps updated_at = now(). Attach to any table with an updated_at column.';

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_workspaces_set_updated_at on public.workspaces;
create trigger trg_workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

drop trigger if exists trg_workspace_members_set_updated_at on public.workspace_members;
create trigger trg_workspace_members_set_updated_at
  before update on public.workspace_members
  for each row execute function public.set_updated_at();
