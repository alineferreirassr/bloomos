-- Finance migration 4 of 8: widen the shared notes/timeline_activities
-- CHECK constraints to accept owner_type in ('invoice', 'payment', 'expense'),
-- and widen timeline_activities' type constraint to accept the 26 Finance
-- activity types.
--
-- Same widening pattern as every previous migration. No table shape
-- changes, no data migration — existing rows are unaffected. Note there is
-- no "payment_updated" type — the mock deliberately records nothing for a
-- plain Payment content edit (see lib/data/index.ts's updatePayment),
-- unlike Invoice/Expense, so it's correctly omitted below.

alter table public.notes drop constraint notes_owner_type_check;
alter table public.notes add constraint notes_owner_type_check
  check (owner_type in ('lead', 'client', 'event', 'contract', 'invoice', 'payment', 'expense'));

alter table public.timeline_activities drop constraint timeline_activities_owner_type_check;
alter table public.timeline_activities add constraint timeline_activities_owner_type_check
  check (owner_type in ('lead', 'client', 'event', 'contract', 'invoice', 'payment', 'expense'));

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
    'contract_declined', 'contract_cancelled', 'contract_completed', 'contract_archived', 'contract_restored',
    'invoice_created', 'invoice_updated', 'invoice_issued', 'invoice_sent', 'invoice_viewed',
    'invoice_partially_paid', 'invoice_paid', 'invoice_overdue', 'invoice_voided', 'invoice_archived',
    'invoice_restored',
    'payment_created', 'payment_processing', 'payment_succeeded', 'payment_failed', 'payment_refunded',
    'payment_cancelled',
    'expense_created', 'expense_updated', 'expense_approved', 'expense_marked_due', 'expense_paid',
    'expense_reimbursed', 'expense_cancelled', 'expense_archived', 'expense_restored'
  )
);
