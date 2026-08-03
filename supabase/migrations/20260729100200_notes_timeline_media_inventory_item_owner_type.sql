-- Inventory migration 3 of 7: widen the shared notes/timeline_activities/
-- media_assets CHECK constraints to accept owner_type = 'inventory_item',
-- and widen timeline_activities' type constraint to add the 5 new
-- Inventory activity types. Same one-migration-at-a-time widening
-- discipline already established for every previous module (most recently
-- Documents' 20260722100300 migration).
--
-- No table shape changes, no data migration — existing rows are
-- unaffected. This is what makes Notes/Timeline/Attachments "generically
-- accept Inventory ownership" real at the database layer, matching what
-- was already true at the application layer (owner_type is typed as the
-- shared EntityType union everywhere) since the Inventory Foundation phase.

alter table public.notes drop constraint notes_owner_type_check;
alter table public.notes add constraint notes_owner_type_check
  check (owner_type in ('lead', 'client', 'event', 'contract', 'invoice', 'payment', 'expense', 'document', 'document_folder', 'inventory_item'));

alter table public.timeline_activities drop constraint timeline_activities_owner_type_check;
alter table public.timeline_activities add constraint timeline_activities_owner_type_check
  check (owner_type in ('lead', 'client', 'event', 'contract', 'invoice', 'payment', 'expense', 'document', 'document_folder', 'inventory_item'));

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
      'inventory_movement_recorded'
    )
  );

alter table public.media_assets drop constraint media_assets_owner_type_check;
alter table public.media_assets add constraint media_assets_owner_type_check
  check (owner_type in ('lead', 'client', 'event', 'document', 'inventory_item'));
