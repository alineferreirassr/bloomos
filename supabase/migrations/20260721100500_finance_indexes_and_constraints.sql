-- Finance migration 6 of 8: indexes and constraints.
--
-- Mirrors the query patterns getInvoices()/getPayments()/getExpenses()/
-- refund-ceiling lookups/applyPaymentToInvoice's recompute actually use:
-- list-by-workspace, filter by status/client/event/contract/invoice, and
-- the workspace-scoped invoice-number uniqueness every Invoice must
-- satisfy (the durable, concurrency-safe backstop for the collision loop
-- generate_invoice_number, migration 8, already avoids in the common case).

create unique index if not exists invoices_workspace_number_unique
  on public.invoices (workspace_id, invoice_number);

create index if not exists invoices_workspace_id_idx on public.invoices (workspace_id);
create index if not exists invoices_workspace_status_idx on public.invoices (workspace_id, status);
create index if not exists invoices_client_id_idx on public.invoices (client_id);
create index if not exists invoices_event_id_idx on public.invoices (event_id);
create index if not exists invoices_contract_id_idx on public.invoices (contract_id);

create index if not exists payments_workspace_id_idx on public.payments (workspace_id);
create index if not exists payments_workspace_status_idx on public.payments (workspace_id, status);
create index if not exists payments_invoice_id_idx on public.payments (invoice_id);
create index if not exists payments_client_id_idx on public.payments (client_id);
create index if not exists payments_event_id_idx on public.payments (event_id);
create index if not exists payments_contract_id_idx on public.payments (contract_id);
-- Supports the refund-ceiling lookup (WHERE reference = 'refund_of:{id}') that
-- process_payment_refund/getPaymentRefundableAmount (migration 8) run on every call.
create index if not exists payments_reference_idx on public.payments (reference) where reference is not null;

create index if not exists expenses_workspace_id_idx on public.expenses (workspace_id);
create index if not exists expenses_workspace_status_idx on public.expenses (workspace_id, status);
create index if not exists expenses_event_id_idx on public.expenses (event_id);
create index if not exists expenses_client_id_idx on public.expenses (client_id);
create index if not exists expenses_contract_id_idx on public.expenses (contract_id);
