-- Media Library migration 6 of 6: widen timeline_activities_type_check only.
--
-- timeline_activities_owner_type_check is untouched — media asset activity
-- is always recorded against the *owning* entity (lead/client/event, all
-- already valid owner types), never against 'media_asset' itself. Only the
-- allowed `type` values need widening, same pattern as every previous
-- phase's widening migration.

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
    'media_asset_uploaded', 'media_asset_version_replaced', 'media_asset_archived', 'media_asset_restored'
  )
);
