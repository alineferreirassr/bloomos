-- Finance Database migration 9 of 11: RLS enablement + policies.
--
-- Same shape as every prior module: workspace isolation only via
-- is_workspace_member(workspace_id), no bespoke owner/admin role gating
-- embedded in RLS (granular Finance permissions like finance.ledger.manage
-- are an application-layer concern via core/permissions, matching how every
-- other module in this codebase already draws that line — Purchases/
-- Inventory/Vendors ship with zero permission-gated RLS today either), and
-- no anonymous access.
--
-- No table in this migration gets a DELETE policy — the append-only
-- triggers (migration 8) already make deletion impossible at the database
-- layer for journal_entries/journal_lines regardless of RLS, and
-- chart_of_accounts/accounting_periods use their existing archived_at /
-- status lifecycle instead of ever being deleted, matching the soft-delete
-- convention every table in this schema already follows.
--
-- journal_entries/journal_lines get INSERT/UPDATE policies scoped to
-- workspace membership — but RLS is the *access* boundary here, not the
-- *correctness* boundary: it does not by itself prevent an unbalanced or
-- out-of-period insert. That protection comes entirely from the triggers
-- in migration 8, which apply regardless of which path performed the
-- write. This split is deliberate (see the Finance Database Blueprint's RLS
-- Blueprint section).
--
-- stripe_webhook_events is the one table with NO authenticated-role
-- insert/update policy at all — Stripe is not a logged-in session, so its
-- writer is exclusively the service role (which bypasses RLS by default).
-- Authenticated users get a read-only, workspace-scoped SELECT policy that
-- also excludes rows whose workspace_id hasn't been resolved yet (nullable
-- until a future Stripe-account-to-workspace mapping exists).

alter table public.chart_of_accounts enable row level security;

create policy "chart_of_accounts_select_workspace_member"
  on public.chart_of_accounts for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "chart_of_accounts_insert_workspace_member"
  on public.chart_of_accounts for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "chart_of_accounts_update_workspace_member"
  on public.chart_of_accounts for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

alter table public.accounting_periods enable row level security;

create policy "accounting_periods_select_workspace_member"
  on public.accounting_periods for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "accounting_periods_insert_workspace_member"
  on public.accounting_periods for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "accounting_periods_update_workspace_member"
  on public.accounting_periods for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

alter table public.journal_entries enable row level security;

create policy "journal_entries_select_workspace_member"
  on public.journal_entries for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "journal_entries_insert_workspace_member"
  on public.journal_entries for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "journal_entries_update_workspace_member"
  on public.journal_entries for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

alter table public.journal_lines enable row level security;

create policy "journal_lines_select_workspace_member"
  on public.journal_lines for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "journal_lines_insert_workspace_member"
  on public.journal_lines for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

-- No update policy for journal_lines — combined with the append-only
-- trigger (migration 8) that unconditionally rejects UPDATE, there is no
-- legitimate update path at either layer.

alter table public.stripe_webhook_events enable row level security;

create policy "stripe_webhook_events_select_workspace_member"
  on public.stripe_webhook_events for select
  to authenticated
  using (workspace_id is not null and public.is_workspace_member(workspace_id));

-- No insert/update policy for authenticated — this table is written
-- exclusively by the service role (the webhook handler is not a logged-in
-- user session).
