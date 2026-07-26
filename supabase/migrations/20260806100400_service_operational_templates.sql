-- Services migration 5: operational template tables —
-- service_checklist_template_items, service_timeline_template_items,
-- service_questionnaire_questions, service_budget_template_lines.
--
-- Mirror src/types/serviceChecklistTemplateItem.ts,
-- serviceTimelineTemplateItem.ts, serviceQuestionnaireQuestion.ts,
-- serviceBudgetTemplateLine.ts exactly. Checklist/timeline categories reuse
-- the exact same CHECK vocabulary checklist_items/event_schedule_items
-- already use (checklistCategory.ts/scheduleCategory.ts) — a generated row
-- copies these values directly into a real checklist_items/
-- event_schedule_items row, so the vocabularies must never diverge.

create table if not exists public.service_checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  title text not null,
  description text,
  category text not null,
  priority text not null,
  due_offset_days integer,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_checklist_template_items_title_not_blank_check check (btrim(title) <> ''),
  constraint service_checklist_template_items_category_check check (
    category in (
      'planning', 'client', 'venue', 'decor', 'flowers', 'photography', 'video', 'food_beverage',
      'transportation', 'team', 'inventory', 'finance', 'legal', 'weather', 'setup', 'cleanup',
      'post_event', 'other'
    )
  ),
  constraint service_checklist_template_items_priority_check check (priority in ('low', 'normal', 'high', 'critical')),
  constraint service_checklist_template_items_display_order_check check (display_order >= 0)
);

comment on table public.service_checklist_template_items is
  'A reusable checklist item a Service generates on every Event it is assigned to. due_offset_days is resolved against the Event''s own date at generation time (resolveOffsetDueDate). See docs/services.md.';

create table if not exists public.service_timeline_template_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  title text not null,
  description text,
  category text not null,
  offset_minutes_from_event_start integer not null,
  duration_minutes integer,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_timeline_template_items_title_not_blank_check check (btrim(title) <> ''),
  constraint service_timeline_template_items_category_check check (
    category in (
      'arrival', 'delivery', 'setup', 'vendor', 'client', 'surprise', 'ceremony', 'photography',
      'video', 'food_beverage', 'cleanup', 'departure', 'other'
    )
  ),
  constraint service_timeline_template_items_duration_minutes_check check (duration_minutes is null or duration_minutes >= 0),
  constraint service_timeline_template_items_display_order_check check (display_order >= 0)
);

comment on table public.service_timeline_template_items is
  'A reusable day-of schedule entry a Service generates on every Event it is assigned to. offset_minutes_from_event_start is resolved against the Event''s own start time at generation time (resolveOffsetTime). See docs/services.md.';

create table if not exists public.service_questionnaire_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  question_text text not null,
  question_type text not null,
  is_required boolean not null default false,
  options text[],
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_questionnaire_questions_text_not_blank_check check (btrim(question_text) <> ''),
  constraint service_questionnaire_questions_type_check check (
    question_type in ('short_text', 'long_text', 'single_choice', 'multi_choice', 'boolean', 'date')
  ),
  constraint service_questionnaire_questions_display_order_check check (display_order >= 0)
);

comment on table public.service_questionnaire_questions is
  'A question a Service wants asked of the client when booked. The Service owns the QUESTION; event_service_questionnaire_responses owns the ANSWER. options is only meaningful for single_choice/multi_choice. See docs/services.md.';

create table if not exists public.service_budget_template_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  label text not null,
  category text,
  estimated_revenue_minor integer not null default 0,
  estimated_cost_minor integer not null default 0,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_budget_template_lines_label_not_blank_check check (btrim(label) <> ''),
  constraint service_budget_template_lines_estimated_revenue_minor_check check (estimated_revenue_minor >= 0),
  constraint service_budget_template_lines_estimated_cost_minor_check check (estimated_cost_minor >= 0),
  constraint service_budget_template_lines_display_order_check check (display_order >= 0)
);

comment on table public.service_budget_template_lines is
  'An estimated revenue/cost line a Service contributes to an Event''s forward-looking Estimated Budget — never feeds Finance''s real, ledger-derived EventFinancialSummary. See docs/services.md.';
