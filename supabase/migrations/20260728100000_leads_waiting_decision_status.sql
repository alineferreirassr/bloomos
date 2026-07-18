-- Phase 2 (Booking Workflow) migration 1 of 2: adds the new `waiting_decision`
-- Lead status between `proposal_sent` and `converted` in the Commercial
-- Pipeline. Postgres has no "alter check constraint" — the existing
-- constraint is dropped and recreated with the widened value list; no data
-- migration is needed since this only adds a new legal value, never removes
-- one, and no existing row can already hold it.

alter table public.leads drop constraint leads_status_check;

alter table public.leads
  add constraint leads_status_check check (
    status in (
      'new', 'contacted', 'welcome_guide_sent', 'consultation_scheduled',
      'qualified', 'proposal_sent', 'waiting_decision', 'converted', 'lost', 'archived'
    )
  );
