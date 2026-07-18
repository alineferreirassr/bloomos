-- Client Portal MVP migration 3 of 5: additive client-facing RLS for
-- invoices and payments.
--
-- Row-level only, per the approved design — this policy controls WHICH
-- invoice/payment rows a client caller can reach, never which columns.
-- Column-level safety (never exposing payments.reference/notes/document_id
-- or invoices.notes to a client) is enforced entirely in the client-safe
-- repository layer (lib/data/clientPortal/) via explicit column selection,
-- never select("*") — see docs/permissions.md's Client Portal MVP section.
--
-- invoices: a client reads only Invoices belonging to their own Client
-- record.
create policy "invoices_select_client_account"
  on public.invoices for select
  to authenticated
  using (public.is_client_account_holder_in_workspace(workspace_id, client_id));

-- payments: a client reads only Payments belonging to their own Client
-- record. expenses deliberately gets no client-facing policy — expenses
-- has its own client_id column (a genuine, easy-to-miss exception in this
-- schema), but a client must never see internal cost data under any
-- circumstance.
create policy "payments_select_client_account"
  on public.payments for select
  to authenticated
  using (public.is_client_account_holder_in_workspace(workspace_id, client_id));
