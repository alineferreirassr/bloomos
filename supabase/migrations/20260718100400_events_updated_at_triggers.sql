-- Events migration 5 of 8: attach the shared updated_at trigger.
--
-- Reuses public.set_updated_at() from the Supabase Foundation, exactly like
-- leads/notes/clients did. checklist_items and event_schedule_items both
-- have a real updated_at column (unlike timeline_activities), so both get
-- the trigger too.

drop trigger if exists trg_events_set_updated_at on public.events;
create trigger trg_events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists trg_checklist_items_set_updated_at on public.checklist_items;
create trigger trg_checklist_items_set_updated_at
  before update on public.checklist_items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_event_schedule_items_set_updated_at on public.event_schedule_items;
create trigger trg_event_schedule_items_set_updated_at
  before update on public.event_schedule_items
  for each row execute function public.set_updated_at();
