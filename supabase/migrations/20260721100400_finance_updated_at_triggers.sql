-- Finance migration 5 of 8: updated_at triggers.
--
-- Reuses the generic public.set_updated_at() function defined in
-- 20260715150400_updated_at_trigger.sql — no bespoke function per table.

drop trigger if exists trg_invoices_set_updated_at on public.invoices;
create trigger trg_invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

drop trigger if exists trg_payments_set_updated_at on public.payments;
create trigger trg_payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

drop trigger if exists trg_expenses_set_updated_at on public.expenses;
create trigger trg_expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();
