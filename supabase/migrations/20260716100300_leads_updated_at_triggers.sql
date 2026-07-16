-- Leads migration 4 of 4a: attach the shared updated_at trigger.
--
-- Reuses public.set_updated_at() from the Supabase Foundation
-- (20260715150400_updated_at_trigger.sql) rather than redefining it.
-- timeline_activities is intentionally excluded — it has no updated_at
-- column (append-only, immutable).

drop trigger if exists trg_leads_set_updated_at on public.leads;
create trigger trg_leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists trg_notes_set_updated_at on public.notes;
create trigger trg_notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();
