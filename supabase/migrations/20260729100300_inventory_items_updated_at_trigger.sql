-- Inventory migration 4 of 7: attach the shared updated_at trigger to
-- inventory_items only.
--
-- Reuses public.set_updated_at() from the Supabase Foundation
-- (20260715150400_updated_at_trigger.sql), exactly like every other
-- module's table. No trigger on inventory_movements — it has no
-- updated_at column at all (immutable, matching timeline_activities).

drop trigger if exists trg_inventory_items_set_updated_at on public.inventory_items;
create trigger trg_inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();
