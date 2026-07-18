-- Client Accounts + Invitations foundation migration 4 of 8: updated_at
-- triggers. Reuses the shared public.set_updated_at() function from the
-- Supabase Foundation phase.

drop trigger if exists trg_client_accounts_set_updated_at on public.client_accounts;
create trigger trg_client_accounts_set_updated_at
  before update on public.client_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_client_invitations_set_updated_at on public.client_invitations;
create trigger trg_client_invitations_set_updated_at
  before update on public.client_invitations
  for each row execute function public.set_updated_at();
