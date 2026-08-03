-- Clients migration 2 of 6: widen the shared notes/timeline_activities
-- CHECK constraints to accept owner_type = 'client', and widen
-- timeline_activities' type constraint to accept the Client-specific
-- activity types (plus lead_converted, since Lead -> Client conversion goes
-- live in this same phase — see migration 6 of 6).
--
-- Exactly the widening anticipated by 20260716100100_notes.sql's and
-- 20260716100200_timeline_activities.sql's own comments: "Each future
-- module's own migration phase must widen this CHECK constraint when it
-- adds a real Supabase-backed owner type." No table shape changes, no data
-- migration needed — existing 'lead'-owned rows are unaffected.

alter table public.notes drop constraint notes_owner_type_check;
alter table public.notes add constraint notes_owner_type_check check (owner_type in ('lead', 'client'));

alter table public.timeline_activities drop constraint timeline_activities_owner_type_check;
alter table public.timeline_activities add constraint timeline_activities_owner_type_check
  check (owner_type in ('lead', 'client'));

alter table public.timeline_activities drop constraint timeline_activities_type_check;
alter table public.timeline_activities add constraint timeline_activities_type_check check (
  type in (
    'lead_created', 'lead_updated', 'status_changed', 'note_added',
    'note_pinned', 'note_unpinned', 'welcome_guide_sent', 'lead_archived', 'lead_converted',
    'client_created', 'client_updated', 'tags_changed', 'vip_status_changed',
    'communication_preference_changed', 'client_archived', 'client_restored'
  )
);
