-- Contracts migration 6 of 8: indexes and constraints.
--
-- Mirrors the query patterns getContracts()/getContractExhibitsByContractId()/
-- the dashboard's contractStats actually use: list-by-workspace, filter by
-- status/client/event, sort/search, and the workspace-scoped
-- contract-number uniqueness every Contract must satisfy (the "duplicate
-- prevention" the mock's generateContractNumber() collision loop already
-- guarantees in-memory — this is the durable, concurrency-safe backstop).

create unique index if not exists contracts_workspace_number_unique
  on public.contracts (workspace_id, contract_number);

create index if not exists contracts_workspace_id_idx on public.contracts (workspace_id);
create index if not exists contracts_workspace_status_idx on public.contracts (workspace_id, status);
create index if not exists contracts_client_id_idx on public.contracts (client_id);
create index if not exists contracts_event_id_idx on public.contracts (event_id);
create index if not exists contracts_template_id_idx on public.contracts (template_id);

create index if not exists contract_templates_workspace_id_idx on public.contract_templates (workspace_id);

create index if not exists contract_exhibits_workspace_contract_idx
  on public.contract_exhibits (workspace_id, contract_id);
create index if not exists contract_exhibits_workspace_contract_order_idx
  on public.contract_exhibits (workspace_id, contract_id, display_order);
