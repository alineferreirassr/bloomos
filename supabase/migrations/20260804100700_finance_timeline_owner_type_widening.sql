-- Finance Posting Engine migration 8 of 9: widen
-- timeline_activities_owner_type_check to add 'accounting_period'.
--
-- Deliberately deferred from the Database Schema phase's own timeline
-- widening (which touched only the `type` constraint, not `owner_type`) —
-- that migration's own comment explained why: "no Journal Entry or
-- Accounting Period Timeline-writing code exists yet... widening owner_type
-- is deferred to the Posting Engine implementation phase, when the actual
-- Timeline-writing behavior is built." This is that phase: close_period and
-- lock_period (migration 9 of this set) are the first code to actually
-- insert a Timeline row owned by an accounting_period.
--
-- 'journal_entry' is NOT added here — no RPC in this migration set writes a
-- Timeline row owned by a Journal Entry directly (record_manual_adjustment
-- has no Timeline requirement per the approved brief; every other posting
-- RPC's financial impact rides along on the Timeline row its own
-- originating domain event already writes, e.g. purchase_item_received).
-- Only 'accounting_period' is genuinely needed by this phase's code.

alter table public.timeline_activities drop constraint timeline_activities_owner_type_check;
alter table public.timeline_activities
  add constraint timeline_activities_owner_type_check
  check (owner_type in (
    'lead', 'client', 'event', 'contract', 'invoice', 'payment', 'expense', 'document', 'document_folder',
    'inventory_item', 'vendor', 'purchase', 'accounting_period'
  ));
