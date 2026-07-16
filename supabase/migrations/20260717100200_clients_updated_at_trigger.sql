-- Clients migration 3 of 6: attach the shared updated_at trigger.
--
-- Reuses public.set_updated_at() from the Supabase Foundation
-- (20260715150400_updated_at_trigger.sql), exactly like leads/notes did.

drop trigger if exists trg_clients_set_updated_at on public.clients;
create trigger trg_clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();
