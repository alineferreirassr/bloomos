-- Services migration 16: published-version immutability, enforced at the
-- DB layer.
--
-- Resolves docs/services.md's "Locked domain decisions" #3. This
-- codebase's RLS is workspace-isolation only, never a business rule — so
-- without this trigger, nothing at the DB layer would stop a direct write
-- to a template row whose parent ServiceVersion has already been
-- published, even though the mock/Supabase repository's own application
-- layer already rejects it (canEditServiceVersionTemplates). Given this
-- specific invariant is the entire foundation of the versioning
-- architecture's historical-reproducibility promise — not just a UX
-- nicety like most other business rules in this schema — it gets the
-- stronger guarantee.
--
-- One shared trigger function, parameterized by nothing (it always reads
-- NEW.service_version_id/OLD.service_version_id, present on every one of
-- the 16 template tables by construction), attached to all 16 rather than
-- one bespoke function per table.
--
-- security invoker, matching every other function in this schema — RLS on
-- service_versions still applies to the lookup this function performs.

create or replace function public.reject_write_to_published_service_version()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version_id uuid;
  v_status text;
begin
  v_version_id := coalesce(new.service_version_id, old.service_version_id);

  select status into v_status from public.service_versions where id = v_version_id;

  if v_status = 'published' then
    raise exception 'This Service version has already been published and its templates can no longer be edited.' using errcode = 'P0020';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.reject_write_to_published_service_version() is
  'Rejects any insert/update/delete against a template table whose parent service_versions.status = ''published'' — the DB-layer enforcement of Service version immutability. See docs/services.md.';

drop trigger if exists trg_service_included_items_reject_published_write on public.service_included_items;
create trigger trg_service_included_items_reject_published_write
  before insert or update or delete on public.service_included_items
  for each row execute function public.reject_write_to_published_service_version();

drop trigger if exists trg_service_addons_reject_published_write on public.service_addons;
create trigger trg_service_addons_reject_published_write
  before insert or update or delete on public.service_addons
  for each row execute function public.reject_write_to_published_service_version();

drop trigger if exists trg_service_checklist_template_items_reject_published_write on public.service_checklist_template_items;
create trigger trg_service_checklist_template_items_reject_published_write
  before insert or update or delete on public.service_checklist_template_items
  for each row execute function public.reject_write_to_published_service_version();

drop trigger if exists trg_service_timeline_template_items_reject_published_write on public.service_timeline_template_items;
create trigger trg_service_timeline_template_items_reject_published_write
  before insert or update or delete on public.service_timeline_template_items
  for each row execute function public.reject_write_to_published_service_version();

drop trigger if exists trg_service_questionnaire_questions_reject_published_write on public.service_questionnaire_questions;
create trigger trg_service_questionnaire_questions_reject_published_write
  before insert or update or delete on public.service_questionnaire_questions
  for each row execute function public.reject_write_to_published_service_version();

drop trigger if exists trg_service_budget_template_lines_reject_published_write on public.service_budget_template_lines;
create trigger trg_service_budget_template_lines_reject_published_write
  before insert or update or delete on public.service_budget_template_lines
  for each row execute function public.reject_write_to_published_service_version();

drop trigger if exists trg_service_approval_template_items_reject_published_write on public.service_approval_template_items;
create trigger trg_service_approval_template_items_reject_published_write
  before insert or update or delete on public.service_approval_template_items
  for each row execute function public.reject_write_to_published_service_version();

drop trigger if exists trg_service_travel_template_items_reject_published_write on public.service_travel_template_items;
create trigger trg_service_travel_template_items_reject_published_write
  before insert or update or delete on public.service_travel_template_items
  for each row execute function public.reject_write_to_published_service_version();

drop trigger if exists trg_service_required_documents_reject_published_write on public.service_required_documents;
create trigger trg_service_required_documents_reject_published_write
  before insert or update or delete on public.service_required_documents
  for each row execute function public.reject_write_to_published_service_version();

drop trigger if exists trg_service_ai_knowledge_items_reject_published_write on public.service_ai_knowledge_items;
create trigger trg_service_ai_knowledge_items_reject_published_write
  before insert or update or delete on public.service_ai_knowledge_items
  for each row execute function public.reject_write_to_published_service_version();

drop trigger if exists trg_service_inventory_template_items_reject_published_write on public.service_inventory_template_items;
create trigger trg_service_inventory_template_items_reject_published_write
  before insert or update or delete on public.service_inventory_template_items
  for each row execute function public.reject_write_to_published_service_version();

drop trigger if exists trg_service_purchase_template_items_reject_published_write on public.service_purchase_template_items;
create trigger trg_service_purchase_template_items_reject_published_write
  before insert or update or delete on public.service_purchase_template_items
  for each row execute function public.reject_write_to_published_service_version();

drop trigger if exists trg_service_vendor_suggestions_reject_published_write on public.service_vendor_suggestions;
create trigger trg_service_vendor_suggestions_reject_published_write
  before insert or update or delete on public.service_vendor_suggestions
  for each row execute function public.reject_write_to_published_service_version();

drop trigger if exists trg_service_team_role_requirements_reject_published_write on public.service_team_role_requirements;
create trigger trg_service_team_role_requirements_reject_published_write
  before insert or update or delete on public.service_team_role_requirements
  for each row execute function public.reject_write_to_published_service_version();

drop trigger if exists trg_service_seasonal_windows_reject_published_write on public.service_seasonal_windows;
create trigger trg_service_seasonal_windows_reject_published_write
  before insert or update or delete on public.service_seasonal_windows
  for each row execute function public.reject_write_to_published_service_version();

drop trigger if exists trg_service_capability_requirements_reject_published_write on public.service_capability_requirements;
create trigger trg_service_capability_requirements_reject_published_write
  before insert or update or delete on public.service_capability_requirements
  for each row execute function public.reject_write_to_published_service_version();
