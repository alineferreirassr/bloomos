-- Services migration 11: Instance-layer engagement child tables —
-- event_service_vendor_assignments, event_service_questionnaire_responses.
--
-- Mirror src/types/eventServiceVendorAssignment.ts,
-- eventServiceQuestionnaireResponse.ts exactly.
--
-- event_service_vendor_assignments starts as "suggested" (copied from
-- service_vendor_suggestions at assignment time) — a human then confirms
-- one or declines it; the Service's own suggestion never changes as a
-- result.
--
-- event_service_questionnaire_responses.question_id points at the pinned
-- ServiceVersion's own question row — stable for the life of this
-- EventService. Exactly one of the four response_* fields is populated,
-- matching the question's own question_type; not enforced as a DB
-- constraint (mirrors the application-layer validation convention used
-- elsewhere for this class of "shape depends on a sibling field" rule).

create table if not exists public.event_service_vendor_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event_service_id uuid not null references public.event_services (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id),
  status text not null default 'suggested',
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint event_service_vendor_assignments_status_check check (status in ('suggested', 'confirmed', 'declined'))
);

comment on table public.event_service_vendor_assignments is
  'Generated from service_vendor_suggestions at assignment as "suggested" — a human confirms one or declines it for this specific booking. See docs/services.md.';

create table if not exists public.event_service_questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event_service_id uuid not null references public.event_services (id) on delete cascade,
  question_id uuid not null references public.service_questionnaire_questions (id),
  response_text text,
  response_options text[],
  response_boolean boolean,
  response_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint event_service_questionnaire_responses_unique unique (event_service_id, question_id)
);

comment on table public.event_service_questionnaire_responses is
  'A client''s actual answer to one service_questionnaire_questions row, for one specific booking. The Service owns the QUESTION; this row owns only the ANSWER. See docs/services.md.';
