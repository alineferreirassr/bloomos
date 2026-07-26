-- Services migration 14: updated_at triggers.
--
-- Reuses the generic public.set_updated_at() function every other module
-- in this schema already uses — no bespoke function per table. One trigger
-- per mutable table across the catalog, template, and Instance layers (26
-- tables total). None of these are append-only ledgers, so none are
-- deliberately omitted the way inventory_movements' trigger was.

drop trigger if exists trg_service_categories_set_updated_at on public.service_categories;
create trigger trg_service_categories_set_updated_at
  before update on public.service_categories
  for each row execute function public.set_updated_at();

drop trigger if exists trg_services_set_updated_at on public.services;
create trigger trg_services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_versions_set_updated_at on public.service_versions;
create trigger trg_service_versions_set_updated_at
  before update on public.service_versions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_included_items_set_updated_at on public.service_included_items;
create trigger trg_service_included_items_set_updated_at
  before update on public.service_included_items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_addons_set_updated_at on public.service_addons;
create trigger trg_service_addons_set_updated_at
  before update on public.service_addons
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_checklist_template_items_set_updated_at on public.service_checklist_template_items;
create trigger trg_service_checklist_template_items_set_updated_at
  before update on public.service_checklist_template_items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_timeline_template_items_set_updated_at on public.service_timeline_template_items;
create trigger trg_service_timeline_template_items_set_updated_at
  before update on public.service_timeline_template_items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_questionnaire_questions_set_updated_at on public.service_questionnaire_questions;
create trigger trg_service_questionnaire_questions_set_updated_at
  before update on public.service_questionnaire_questions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_budget_template_lines_set_updated_at on public.service_budget_template_lines;
create trigger trg_service_budget_template_lines_set_updated_at
  before update on public.service_budget_template_lines
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_approval_template_items_set_updated_at on public.service_approval_template_items;
create trigger trg_service_approval_template_items_set_updated_at
  before update on public.service_approval_template_items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_travel_template_items_set_updated_at on public.service_travel_template_items;
create trigger trg_service_travel_template_items_set_updated_at
  before update on public.service_travel_template_items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_required_documents_set_updated_at on public.service_required_documents;
create trigger trg_service_required_documents_set_updated_at
  before update on public.service_required_documents
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_ai_knowledge_items_set_updated_at on public.service_ai_knowledge_items;
create trigger trg_service_ai_knowledge_items_set_updated_at
  before update on public.service_ai_knowledge_items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_inventory_template_items_set_updated_at on public.service_inventory_template_items;
create trigger trg_service_inventory_template_items_set_updated_at
  before update on public.service_inventory_template_items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_purchase_template_items_set_updated_at on public.service_purchase_template_items;
create trigger trg_service_purchase_template_items_set_updated_at
  before update on public.service_purchase_template_items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_vendor_suggestions_set_updated_at on public.service_vendor_suggestions;
create trigger trg_service_vendor_suggestions_set_updated_at
  before update on public.service_vendor_suggestions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_team_role_requirements_set_updated_at on public.service_team_role_requirements;
create trigger trg_service_team_role_requirements_set_updated_at
  before update on public.service_team_role_requirements
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_seasonal_windows_set_updated_at on public.service_seasonal_windows;
create trigger trg_service_seasonal_windows_set_updated_at
  before update on public.service_seasonal_windows
  for each row execute function public.set_updated_at();

drop trigger if exists trg_service_capability_requirements_set_updated_at on public.service_capability_requirements;
create trigger trg_service_capability_requirements_set_updated_at
  before update on public.service_capability_requirements
  for each row execute function public.set_updated_at();

drop trigger if exists trg_event_services_set_updated_at on public.event_services;
create trigger trg_event_services_set_updated_at
  before update on public.event_services
  for each row execute function public.set_updated_at();

drop trigger if exists trg_event_service_inventory_requirements_set_updated_at on public.event_service_inventory_requirements;
create trigger trg_event_service_inventory_requirements_set_updated_at
  before update on public.event_service_inventory_requirements
  for each row execute function public.set_updated_at();

drop trigger if exists trg_event_service_purchase_requirements_set_updated_at on public.event_service_purchase_requirements;
create trigger trg_event_service_purchase_requirements_set_updated_at
  before update on public.event_service_purchase_requirements
  for each row execute function public.set_updated_at();

drop trigger if exists trg_event_service_budget_lines_set_updated_at on public.event_service_budget_lines;
create trigger trg_event_service_budget_lines_set_updated_at
  before update on public.event_service_budget_lines
  for each row execute function public.set_updated_at();

drop trigger if exists trg_event_service_team_requirements_set_updated_at on public.event_service_team_requirements;
create trigger trg_event_service_team_requirements_set_updated_at
  before update on public.event_service_team_requirements
  for each row execute function public.set_updated_at();

drop trigger if exists trg_event_service_vendor_assignments_set_updated_at on public.event_service_vendor_assignments;
create trigger trg_event_service_vendor_assignments_set_updated_at
  before update on public.event_service_vendor_assignments
  for each row execute function public.set_updated_at();

drop trigger if exists trg_event_service_questionnaire_responses_set_updated_at on public.event_service_questionnaire_responses;
create trigger trg_event_service_questionnaire_responses_set_updated_at
  before update on public.event_service_questionnaire_responses
  for each row execute function public.set_updated_at();
