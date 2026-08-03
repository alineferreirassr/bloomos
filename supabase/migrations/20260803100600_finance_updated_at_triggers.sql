-- Finance Database migration 7 of 11: updated_at triggers.
--
-- Reuses the generic public.set_updated_at() function, same as every prior
-- module. Only chart_of_accounts and accounting_periods get one —
-- journal_entries, journal_lines, and stripe_webhook_events deliberately do
-- not, the same "no updated_at on an append-only-style table" choice
-- inventory_movements already made. journal_entries' own narrow, permitted
-- update path (posting_status/failure_reason/reversed_by_entry_id) is
-- tracked by the Journal Entry it links to, not by a generic updated_at
-- column on itself.

drop trigger if exists trg_chart_of_accounts_set_updated_at on public.chart_of_accounts;
create trigger trg_chart_of_accounts_set_updated_at
  before update on public.chart_of_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_accounting_periods_set_updated_at on public.accounting_periods;
create trigger trg_accounting_periods_set_updated_at
  before update on public.accounting_periods
  for each row execute function public.set_updated_at();
