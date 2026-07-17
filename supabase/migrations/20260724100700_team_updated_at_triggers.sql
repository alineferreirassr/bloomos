-- Team foundation migration 8 of 11: updated_at triggers.
--
-- Reuses the shared public.set_updated_at() function from the Supabase
-- Foundation phase. role_permissions is a pure join table (no updated_at
-- column — a grant either exists or doesn't, it's never edited in place)
-- and is intentionally not included here.

drop trigger if exists trg_roles_set_updated_at on public.roles;
create trigger trg_roles_set_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_permissions_set_updated_at on public.permissions;
create trigger trg_permissions_set_updated_at
  before update on public.permissions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_workspace_invitations_set_updated_at on public.workspace_invitations;
create trigger trg_workspace_invitations_set_updated_at
  before update on public.workspace_invitations
  for each row execute function public.set_updated_at();
