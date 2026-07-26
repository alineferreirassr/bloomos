-- Services migration 17: indexes and constraints.
--
-- Adds the category_id foreign key deferred from the services migration
-- (service_categories now exists). Every table gets a plain workspace_id
-- index plus the composite index matching how every repository method
-- actually filters (service_version_id for template tables,
-- event_service_id for Instance-layer child tables) — the same discipline
-- Inventory/Purchases' own indexing migrations already established.
-- event_services additionally gets (workspace_id, event_id), the query
-- every Event Detail page load will issue once the UI phase ships — see
-- docs/services.md's Performance Review, which flagged this as the
-- module's most likely hotspot table.

alter table public.services
  add constraint services_category_id_fkey foreign key (category_id) references public.service_categories (id) on delete set null;

-- ---- Catalog layer ----

create index if not exists service_categories_workspace_id_idx on public.service_categories (workspace_id);

create index if not exists services_workspace_id_idx on public.services (workspace_id);
create index if not exists services_workspace_category_idx on public.services (workspace_id, category_id);
create index if not exists services_workspace_status_idx on public.services (workspace_id, status);

create index if not exists service_versions_workspace_id_idx on public.service_versions (workspace_id);
create index if not exists service_versions_workspace_service_idx on public.service_versions (workspace_id, service_id);
create index if not exists service_versions_workspace_status_idx on public.service_versions (workspace_id, status);

-- ---- Template layer (16 tables) ----

create index if not exists service_included_items_workspace_id_idx on public.service_included_items (workspace_id);
create index if not exists service_included_items_workspace_version_idx on public.service_included_items (workspace_id, service_version_id);

create index if not exists service_addons_workspace_id_idx on public.service_addons (workspace_id);
create index if not exists service_addons_workspace_version_idx on public.service_addons (workspace_id, service_version_id);

create index if not exists service_checklist_template_items_workspace_id_idx on public.service_checklist_template_items (workspace_id);
create index if not exists service_checklist_template_items_workspace_version_idx on public.service_checklist_template_items (workspace_id, service_version_id);

create index if not exists service_timeline_template_items_workspace_id_idx on public.service_timeline_template_items (workspace_id);
create index if not exists service_timeline_template_items_workspace_version_idx on public.service_timeline_template_items (workspace_id, service_version_id);

create index if not exists service_questionnaire_questions_workspace_id_idx on public.service_questionnaire_questions (workspace_id);
create index if not exists service_questionnaire_questions_workspace_version_idx on public.service_questionnaire_questions (workspace_id, service_version_id);

create index if not exists service_budget_template_lines_workspace_id_idx on public.service_budget_template_lines (workspace_id);
create index if not exists service_budget_template_lines_workspace_version_idx on public.service_budget_template_lines (workspace_id, service_version_id);

create index if not exists service_approval_template_items_workspace_id_idx on public.service_approval_template_items (workspace_id);
create index if not exists service_approval_template_items_workspace_version_idx on public.service_approval_template_items (workspace_id, service_version_id);

create index if not exists service_travel_template_items_workspace_id_idx on public.service_travel_template_items (workspace_id);
create index if not exists service_travel_template_items_workspace_version_idx on public.service_travel_template_items (workspace_id, service_version_id);

create index if not exists service_required_documents_workspace_id_idx on public.service_required_documents (workspace_id);
create index if not exists service_required_documents_workspace_version_idx on public.service_required_documents (workspace_id, service_version_id);

create index if not exists service_ai_knowledge_items_workspace_id_idx on public.service_ai_knowledge_items (workspace_id);
create index if not exists service_ai_knowledge_items_workspace_version_idx on public.service_ai_knowledge_items (workspace_id, service_version_id);

create index if not exists service_inventory_template_items_workspace_id_idx on public.service_inventory_template_items (workspace_id);
create index if not exists service_inventory_template_items_workspace_version_idx on public.service_inventory_template_items (workspace_id, service_version_id);
create index if not exists service_inventory_template_items_inventory_item_id_idx on public.service_inventory_template_items (inventory_item_id);

create index if not exists service_purchase_template_items_workspace_id_idx on public.service_purchase_template_items (workspace_id);
create index if not exists service_purchase_template_items_workspace_version_idx on public.service_purchase_template_items (workspace_id, service_version_id);
create index if not exists service_purchase_template_items_typical_vendor_id_idx on public.service_purchase_template_items (typical_vendor_id);

create index if not exists service_vendor_suggestions_workspace_id_idx on public.service_vendor_suggestions (workspace_id);
create index if not exists service_vendor_suggestions_workspace_version_idx on public.service_vendor_suggestions (workspace_id, service_version_id);
create index if not exists service_vendor_suggestions_vendor_id_idx on public.service_vendor_suggestions (vendor_id);

create index if not exists service_team_role_requirements_workspace_id_idx on public.service_team_role_requirements (workspace_id);
create index if not exists service_team_role_requirements_workspace_version_idx on public.service_team_role_requirements (workspace_id, service_version_id);

create index if not exists service_seasonal_windows_workspace_id_idx on public.service_seasonal_windows (workspace_id);
create index if not exists service_seasonal_windows_workspace_version_idx on public.service_seasonal_windows (workspace_id, service_version_id);

create index if not exists service_capability_requirements_workspace_id_idx on public.service_capability_requirements (workspace_id);
create index if not exists service_capability_requirements_workspace_version_idx on public.service_capability_requirements (workspace_id, service_version_id);

-- ---- Instance layer ----

create index if not exists event_services_workspace_id_idx on public.event_services (workspace_id);
create index if not exists event_services_workspace_event_idx on public.event_services (workspace_id, event_id);
create index if not exists event_services_workspace_service_idx on public.event_services (workspace_id, service_id);
create index if not exists event_services_workspace_status_idx on public.event_services (workspace_id, status);

create index if not exists event_service_inventory_requirements_workspace_id_idx on public.event_service_inventory_requirements (workspace_id);
create index if not exists event_service_inventory_requirements_workspace_es_idx on public.event_service_inventory_requirements (workspace_id, event_service_id);

create index if not exists event_service_purchase_requirements_workspace_id_idx on public.event_service_purchase_requirements (workspace_id);
create index if not exists event_service_purchase_requirements_workspace_es_idx on public.event_service_purchase_requirements (workspace_id, event_service_id);

create index if not exists event_service_budget_lines_workspace_id_idx on public.event_service_budget_lines (workspace_id);
create index if not exists event_service_budget_lines_workspace_es_idx on public.event_service_budget_lines (workspace_id, event_service_id);

create index if not exists event_service_team_requirements_workspace_id_idx on public.event_service_team_requirements (workspace_id);
create index if not exists event_service_team_requirements_workspace_es_idx on public.event_service_team_requirements (workspace_id, event_service_id);

create index if not exists event_service_vendor_assignments_workspace_id_idx on public.event_service_vendor_assignments (workspace_id);
create index if not exists event_service_vendor_assignments_workspace_es_idx on public.event_service_vendor_assignments (workspace_id, event_service_id);

create index if not exists event_service_questionnaire_responses_workspace_id_idx on public.event_service_questionnaire_responses (workspace_id);
create index if not exists event_service_questionnaire_responses_workspace_es_idx on public.event_service_questionnaire_responses (workspace_id, event_service_id);

-- ---- Schema-widening columns (checklist_items/event_schedule_items) ----

create index if not exists checklist_items_source_event_service_id_idx on public.checklist_items (source_event_service_id);
create index if not exists event_schedule_items_source_event_service_id_idx on public.event_schedule_items (source_event_service_id);
