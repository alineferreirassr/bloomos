-- Services migration 12: widen the shared notes/timeline_activities CHECK
-- constraints to accept owner_type = 'service'/'event_service', and widen
-- timeline_activities' type constraint to add the 7 Services activity
-- types actually registered by lib/data/services/mockRepository.ts
-- (registerTimelineActivityType calls). Same one-migration-at-a-time
-- widening discipline every previous module has used.
--
-- media_assets is deliberately NOT widened here — unlike every prior
-- module, no Core Files/Attachments front-door delegation exists yet for
-- Services (only Notes/Timeline were built in this Foundation phase; see
-- docs/services.md). Widening it now would open a CHECK the application
-- has no code path to actually use, and would need a matching
-- lib/media/ownerTypes.ts change this phase doesn't otherwise touch —
-- deferred to whichever future phase actually builds that delegation.
--
-- 'event_service' is included as its own EntityType alongside 'service'
-- (not left subordinate) because a Note/Timeline entry about the general
-- Photography offering and a Note/Timeline entry about "Photography, for
-- the Smith wedding specifically" are genuinely different things — see
-- core/enums/entityType.ts's own comment on this.
--
-- Individual template-row edits (checklist/timeline/questionnaire/...
-- template items) are deliberately NOT their own owner types and are not
-- individually Timeline-logged in this phase — see docs/services.md.

alter table public.notes drop constraint notes_owner_type_check;
alter table public.notes add constraint notes_owner_type_check
  check (owner_type in (
    'lead', 'client', 'event', 'contract', 'invoice', 'payment', 'expense', 'document', 'document_folder',
    'inventory_item', 'vendor', 'purchase', 'service', 'event_service'
  ));

alter table public.timeline_activities drop constraint timeline_activities_owner_type_check;
alter table public.timeline_activities
  add constraint timeline_activities_owner_type_check
  check (owner_type in (
    'lead', 'client', 'event', 'contract', 'invoice', 'payment', 'expense', 'document', 'document_folder',
    'inventory_item', 'vendor', 'purchase', 'accounting_period', 'service', 'event_service'
  ));

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
      'journal_entry_posted', 'journal_entry_reversed', 'accounting_period_closed', 'accounting_period_locked',
      'service_created', 'service_updated', 'service_status_changed', 'service_version_published',
      'event_service_assigned', 'event_service_status_changed', 'event_service_removed'
    )
  );
