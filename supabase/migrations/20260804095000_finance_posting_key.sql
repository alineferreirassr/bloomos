-- Finance Posting Engine correction (pre-checkpoint): adds
-- journal_entries.posting_key.
--
-- Additive only — journal_entries is an already-committed table (Finance
-- Database Schema Foundation); this is a genuinely new migration, not an
-- edit to that one. Sorts before every other Posting Engine migration in
-- this uncommitted batch (20260804100000 onward), since
-- finance_insert_journal_entry — used by every posting RPC — is updated in
-- this same batch to require this column to exist.
--
-- posting_key is the SYSTEM-LEVEL idempotency identifier, deliberately
-- distinct from source_type/source_id (the BUSINESS-source reference,
-- unchanged). The two serve different purposes and neither is repurposed
-- as the other:
--   - source_type/source_id answers "what operational document caused
--     this entry" — e.g. source_id = purchase_item_id for a Purchase
--     Receipt, even though the same item may be the source_id of several
--     legitimate entries over multiple partial receipts.
--   - posting_key answers "has this exact financial event already been
--     recorded" — a single, stable, caller-or-system-derived string that
--     must be unique per workspace. Null is permitted (Manual Adjustments,
--     and any other genuinely one-off entry with no natural idempotency
--     key) — the partial unique index below only applies where it is set.
--
-- This does not weaken or replace the existing general posting_key partial
-- unique index on (source_type, source_id) from the Database Schema phase
-- — that index remains exactly as committed. The two mechanisms overlap in
-- coverage for some source_types today (see the Posting Engine correction
-- report's explicit justification for why removing either is not yet
-- warranted), but overlap is not redundancy: this new index is the one
-- Purchase Receipt now relies on exclusively, since its source_id
-- (purchase_item_id) is not itself unique per receipt event.

alter table public.journal_entries add column if not exists posting_key text;

create unique index if not exists journal_entries_workspace_posting_key_unique
  on public.journal_entries (workspace_id, posting_key)
  where posting_key is not null;

comment on column public.journal_entries.posting_key is
  'System-level idempotency identifier, distinct from source_type/source_id (the business-source reference). Null for Manual Adjustments and other one-off entries with no natural idempotency key. Deterministic for one-time-per-source events (e.g. payment_settlement:<payment_id>) and for Purchase Receipt as purchase_receipt:<workspace_id>:<receipt_event_id>, since that source_id (purchase_item_id) is not unique per receipt event.';
