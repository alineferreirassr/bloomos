-- Contracts migration 4 of 8: widen the shared notes/timeline_activities
-- CHECK constraints to accept owner_type = 'contract', and widen
-- timeline_activities' type constraint to accept the 10 Contract activity
-- types.
--
-- Same widening pattern as the Clients/Events migrations. No table shape
-- changes, no data migration — existing 'lead'/'client'/'event'-owned rows
-- are unaffected. media_asset_* types (added by the Media Library phase)
-- are carried forward unchanged.

alter table public.notes drop constraint notes_owner_type_check;
alter table public.notes add constraint notes_owner_type_check
  check (owner_type in ('lead', 'client', 'event', 'contract'));

alter table public.timeline_activities drop constraint timeline_activities_owner_type_check;
alter table public.timeline_activities add constraint timeline_activities_owner_type_check
  check (owner_type in ('lead', 'client', 'event', 'contract'));

alter table public.timeline_activities drop constraint timeline_activities_type_check;
alter table public.timeline_activities add constraint timeline_activities_type_check check (
  type in (
    'lead_created', 'lead_updated', 'status_changed', 'note_added',
    'note_pinned', 'note_unpinned', 'welcome_guide_sent', 'lead_archived', 'lead_converted',
    'client_created', 'client_updated', 'tags_changed', 'vip_status_changed',
    'communication_preference_changed', 'client_archived', 'client_restored',
    'event_created', 'event_updated', 'lifecycle_stage_changed', 'priority_changed',
    'checklist_item_created', 'checklist_item_completed', 'checklist_template_applied',
    'schedule_item_created', 'schedule_item_updated',
    'event_archived', 'event_restored', 'event_cancelled', 'event_completed',
    'media_asset_uploaded', 'media_asset_version_replaced', 'media_asset_archived', 'media_asset_restored',
    'contract_created', 'contract_updated', 'contract_sent', 'contract_viewed', 'contract_signed',
    'contract_declined', 'contract_cancelled', 'contract_completed', 'contract_archived', 'contract_restored'
  )
);
