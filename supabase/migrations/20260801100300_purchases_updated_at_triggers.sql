-- Purchases migration 4 of 7: updated_at triggers.
--
-- Reuses the generic public.set_updated_at() function defined in
-- 20260715150400_updated_at_trigger.sql — no bespoke function per table.
-- Both purchases and purchase_items get one, unlike inventory_movements'
-- deliberate omission — neither purchases nor purchase_items is an
-- append-only ledger.

drop trigger if exists trg_purchases_set_updated_at on public.purchases;
create trigger trg_purchases_set_updated_at
  before update on public.purchases
  for each row execute function public.set_updated_at();

drop trigger if exists trg_purchase_items_set_updated_at on public.purchase_items;
create trigger trg_purchase_items_set_updated_at
  before update on public.purchase_items
  for each row execute function public.set_updated_at();
