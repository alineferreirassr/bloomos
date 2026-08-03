-- Vendors migration 3 of 5: attach the shared updated_at trigger.
--
-- Reuses public.set_updated_at() from the Supabase Foundation
-- (20260715150400_updated_at_trigger.sql), exactly like every other
-- module's table.

drop trigger if exists trg_vendors_set_updated_at on public.vendors;
create trigger trg_vendors_set_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();
