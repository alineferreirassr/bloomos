-- Clients migration 5 of 6: indexes and constraints.
--
-- Mirrors the query patterns getClients()/the dashboard metrics actually
-- use (lib/data/clients/supabaseRepository.ts, getDashboardMetrics() in
-- lib/data/index.ts): list-by-workspace, filter by status, filter by VIP,
-- filter by tag, sort by created_at, and look Clients up by the Lead they
-- originated from.

create index if not exists clients_workspace_id_idx on public.clients (workspace_id);
create index if not exists clients_workspace_status_idx on public.clients (workspace_id, internal_status);
create index if not exists clients_workspace_created_at_idx on public.clients (workspace_id, created_at desc);
create index if not exists clients_workspace_vip_idx on public.clients (workspace_id, is_vip) where is_vip = true;
create index if not exists clients_tags_gin_idx on public.clients using gin (tags);
create index if not exists clients_originating_lead_id_idx on public.clients (originating_lead_id);
