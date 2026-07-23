-- Finance Database migration 6 of 11: widen timeline_activities_type_check
-- to add 4 new Finance activity types.
--
-- Same one-migration-at-a-time widening discipline every previous module
-- has used, and the same "declare the type vocabulary during the schema
-- phase, even though the RPC that will emit it doesn't exist until a later
-- phase" precedent Purchases itself already set — purchase_item_received
-- was added to this same constraint in 20260801100200, a full phase before
-- the receiving RPC that actually inserts it (20260802100000) existed.
--
-- Deliberately narrow: only the `type` constraint is widened here.
-- owner_type is NOT touched in this migration — no Journal Entry or
-- Accounting Period Timeline-writing code exists yet (that only happens
-- inside the future Posting Engine RPCs, out of scope for this
-- database-only phase), so there is nothing yet that needs
-- 'journal_entry'/'accounting_period' accepted as an owner_type. Widening
-- owner_type is deferred to the Posting Engine implementation phase, when
-- the actual Timeline-writing behavior is built and can be tested
-- end-to-end against it, rather than speculatively now.
--
-- journal_entry_posted / journal_entry_reversed cover the two Journal-Entry
-- lifecycle events that don't already ride along on an existing domain
-- Timeline entry (a Purchase receipt's posting, for example, is expected to
-- share the existing 'purchase_item_received' row rather than emit a
-- second one — see the Finance Posting Engine Specification's Audit
-- section). accounting_period_closed / accounting_period_locked cover the
-- two period-lifecycle events, which have no other domain owner at all.

alter table public.timeline_activities drop constraint timeline_activities_type_check;
alter table public.timeline_activities
  add constraint timeline_activities_type_check check (
    type in (
      'lead_created', 'lead_updated', 'status_changed', 'note_added', 'note_pinned', 'note_unpinned',
      'welcome_guide_sent', 'lead_archived', 'lead_converted', 'client_created', 'client_updated',
      'tags_changed', 'vip_status_changed', 'communication_preference_changed', 'client_archived',
      'client_restored', 'client_recovery_pending', 'client_recovery_resolved', 'event_created',
      'event_updated', 'lifecycle_stage_changed', 'priority_changed', 'checklist_item_created',
      'checklist_item_completed', 'checklist_template_applied', 'schedule_item_created',
      'schedule_item_updated', 'event_archived', 'event_restored', 'event_cancelled', 'event_completed',
      'media_asset_uploaded', 'media_asset_version_replaced', 'media_asset_archived', 'media_asset_restored',
      'contract_created', 'contract_updated', 'contract_sent', 'contract_viewed', 'contract_signed',
      'contract_declined', 'contract_cancelled', 'contract_completed', 'contract_archived', 'contract_restored',
      'invoice_created', 'invoice_updated', 'invoice_issued', 'invoice_sent', 'invoice_viewed',
      'invoice_partially_paid', 'invoice_paid', 'invoice_overdue', 'invoice_voided', 'invoice_archived',
      'invoice_restored', 'payment_created', 'payment_processing', 'payment_succeeded', 'payment_failed',
      'payment_refunded', 'payment_cancelled', 'expense_created', 'expense_updated', 'expense_approved',
      'expense_marked_due', 'expense_paid', 'expense_reimbursed', 'expense_cancelled', 'expense_archived',
      'expense_restored', 'document_created', 'document_metadata_updated', 'document_activated',
      'document_version_created', 'document_superseded', 'document_archived', 'document_restored',
      'document_soft_deleted', 'document_expired', 'document_visibility_changed', 'document_moved_to_folder',
      'document_folder_created', 'document_folder_renamed', 'document_folder_moved', 'document_folder_archived',
      'document_folder_restored', 'document_folder_template_applied',
      'inventory_item_created', 'inventory_item_updated', 'inventory_item_archived', 'inventory_item_restored',
      'inventory_movement_recorded',
      'vendor_created', 'vendor_updated', 'vendor_archived', 'vendor_restored', 'vendor_preferred_status_changed',
      'purchase_created', 'purchase_updated', 'purchase_status_changed', 'purchase_archived', 'purchase_restored',
      'purchase_item_added', 'purchase_item_updated', 'purchase_item_removed', 'purchase_item_received',
      'journal_entry_posted', 'journal_entry_reversed', 'accounting_period_closed', 'accounting_period_locked'
    )
  );
