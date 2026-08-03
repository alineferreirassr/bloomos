-- Contracts migration 5 of 8: updated_at triggers.
--
-- Reuses the generic public.set_updated_at() function defined in
-- 20260715150400_updated_at_trigger.sql — no bespoke function per table.

drop trigger if exists trg_contract_templates_set_updated_at on public.contract_templates;
create trigger trg_contract_templates_set_updated_at
  before update on public.contract_templates
  for each row execute function public.set_updated_at();

drop trigger if exists trg_contracts_set_updated_at on public.contracts;
create trigger trg_contracts_set_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_contract_exhibits_set_updated_at on public.contract_exhibits;
create trigger trg_contract_exhibits_set_updated_at
  before update on public.contract_exhibits
  for each row execute function public.set_updated_at();
