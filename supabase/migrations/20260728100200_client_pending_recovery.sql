-- Phase 2 (Booking Workflow) migration 3 of 3: generic, reusable
-- stuck-but-recoverable-operation infrastructure — first consumer is
-- bookLead()'s Event-creation step, but neither the column nor the two new
-- Timeline activity types are Booking-specific. A single nullable jsonb
-- column (not four dedicated columns, not a separate table) keeps this
-- right-sized: null means nothing is stuck; a non-null value is shaped (at
-- the TypeScript layer, see src/types/pendingRecovery.ts) as
-- { version, workflow, status, reason, payload, attempts, first_attempt_at,
-- last_attempt_at }. Any future recoverable workflow reuses this exact
-- column and these exact two Timeline types with a different `workflow`
-- value, instead of adding its own column or Timeline vocabulary.

alter table public.clients add column pending_recovery jsonb null;

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
      'document_folder_restored', 'document_folder_template_applied'
    )
  );
