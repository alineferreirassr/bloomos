-- Services migration 15: RLS enablement + policies for all 26
-- catalog/template/Instance-layer tables.
--
-- Same shape as every other module: workspace isolation only via
-- is_workspace_member(workspace_id), no owner/admin role gating, no
-- anonymous access, no delete policy anywhere — soft delete via
-- archived_at (catalog layer) or simply never physically deleted
-- (templates/Instance layer; removeEventService only deletes still-pending
-- generated rows, which is an application-layer decision, not a DB-level
-- delete policy distinction).
--
-- Published-version immutability (docs/services.md's "Locked domain
-- decisions" #3) is enforced by a separate migration's triggers, not by
-- RLS — RLS in this schema is workspace-isolation only, never a business
-- rule, matching the established discipline everywhere else.

-- ---- Catalog layer ----

alter table public.service_categories enable row level security;
create policy "service_categories_select_workspace_member" on public.service_categories for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_categories_insert_workspace_member" on public.service_categories for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_categories_update_workspace_member" on public.service_categories for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

alter table public.services enable row level security;
create policy "services_select_workspace_member" on public.services for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "services_insert_workspace_member" on public.services for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "services_update_workspace_member" on public.services for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

alter table public.service_versions enable row level security;
create policy "service_versions_select_workspace_member" on public.service_versions for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_versions_insert_workspace_member" on public.service_versions for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_versions_update_workspace_member" on public.service_versions for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- ---- Template layer (16 tables) ----

alter table public.service_included_items enable row level security;
create policy "service_included_items_select_workspace_member" on public.service_included_items for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_included_items_insert_workspace_member" on public.service_included_items for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_included_items_update_workspace_member" on public.service_included_items for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_included_items_delete_workspace_member" on public.service_included_items for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.service_addons enable row level security;
create policy "service_addons_select_workspace_member" on public.service_addons for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_addons_insert_workspace_member" on public.service_addons for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_addons_update_workspace_member" on public.service_addons for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_addons_delete_workspace_member" on public.service_addons for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.service_checklist_template_items enable row level security;
create policy "service_checklist_template_items_select_workspace_member" on public.service_checklist_template_items for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_checklist_template_items_insert_workspace_member" on public.service_checklist_template_items for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_checklist_template_items_update_workspace_member" on public.service_checklist_template_items for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_checklist_template_items_delete_workspace_member" on public.service_checklist_template_items for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.service_timeline_template_items enable row level security;
create policy "service_timeline_template_items_select_workspace_member" on public.service_timeline_template_items for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_timeline_template_items_insert_workspace_member" on public.service_timeline_template_items for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_timeline_template_items_update_workspace_member" on public.service_timeline_template_items for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_timeline_template_items_delete_workspace_member" on public.service_timeline_template_items for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.service_questionnaire_questions enable row level security;
create policy "service_questionnaire_questions_select_workspace_member" on public.service_questionnaire_questions for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_questionnaire_questions_insert_workspace_member" on public.service_questionnaire_questions for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_questionnaire_questions_update_workspace_member" on public.service_questionnaire_questions for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_questionnaire_questions_delete_workspace_member" on public.service_questionnaire_questions for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.service_budget_template_lines enable row level security;
create policy "service_budget_template_lines_select_workspace_member" on public.service_budget_template_lines for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_budget_template_lines_insert_workspace_member" on public.service_budget_template_lines for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_budget_template_lines_update_workspace_member" on public.service_budget_template_lines for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_budget_template_lines_delete_workspace_member" on public.service_budget_template_lines for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.service_approval_template_items enable row level security;
create policy "service_approval_template_items_select_workspace_member" on public.service_approval_template_items for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_approval_template_items_insert_workspace_member" on public.service_approval_template_items for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_approval_template_items_update_workspace_member" on public.service_approval_template_items for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_approval_template_items_delete_workspace_member" on public.service_approval_template_items for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.service_travel_template_items enable row level security;
create policy "service_travel_template_items_select_workspace_member" on public.service_travel_template_items for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_travel_template_items_insert_workspace_member" on public.service_travel_template_items for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_travel_template_items_update_workspace_member" on public.service_travel_template_items for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_travel_template_items_delete_workspace_member" on public.service_travel_template_items for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.service_required_documents enable row level security;
create policy "service_required_documents_select_workspace_member" on public.service_required_documents for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_required_documents_insert_workspace_member" on public.service_required_documents for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_required_documents_update_workspace_member" on public.service_required_documents for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_required_documents_delete_workspace_member" on public.service_required_documents for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.service_ai_knowledge_items enable row level security;
create policy "service_ai_knowledge_items_select_workspace_member" on public.service_ai_knowledge_items for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_ai_knowledge_items_insert_workspace_member" on public.service_ai_knowledge_items for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_ai_knowledge_items_update_workspace_member" on public.service_ai_knowledge_items for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_ai_knowledge_items_delete_workspace_member" on public.service_ai_knowledge_items for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.service_inventory_template_items enable row level security;
create policy "service_inventory_template_items_select_workspace_member" on public.service_inventory_template_items for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_inventory_template_items_insert_workspace_member" on public.service_inventory_template_items for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_inventory_template_items_update_workspace_member" on public.service_inventory_template_items for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_inventory_template_items_delete_workspace_member" on public.service_inventory_template_items for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.service_purchase_template_items enable row level security;
create policy "service_purchase_template_items_select_workspace_member" on public.service_purchase_template_items for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_purchase_template_items_insert_workspace_member" on public.service_purchase_template_items for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_purchase_template_items_update_workspace_member" on public.service_purchase_template_items for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_purchase_template_items_delete_workspace_member" on public.service_purchase_template_items for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.service_vendor_suggestions enable row level security;
create policy "service_vendor_suggestions_select_workspace_member" on public.service_vendor_suggestions for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_vendor_suggestions_insert_workspace_member" on public.service_vendor_suggestions for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_vendor_suggestions_update_workspace_member" on public.service_vendor_suggestions for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_vendor_suggestions_delete_workspace_member" on public.service_vendor_suggestions for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.service_team_role_requirements enable row level security;
create policy "service_team_role_requirements_select_workspace_member" on public.service_team_role_requirements for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_team_role_requirements_insert_workspace_member" on public.service_team_role_requirements for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_team_role_requirements_update_workspace_member" on public.service_team_role_requirements for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_team_role_requirements_delete_workspace_member" on public.service_team_role_requirements for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.service_seasonal_windows enable row level security;
create policy "service_seasonal_windows_select_workspace_member" on public.service_seasonal_windows for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_seasonal_windows_insert_workspace_member" on public.service_seasonal_windows for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_seasonal_windows_update_workspace_member" on public.service_seasonal_windows for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_seasonal_windows_delete_workspace_member" on public.service_seasonal_windows for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.service_capability_requirements enable row level security;
create policy "service_capability_requirements_select_workspace_member" on public.service_capability_requirements for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "service_capability_requirements_insert_workspace_member" on public.service_capability_requirements for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "service_capability_requirements_update_workspace_member" on public.service_capability_requirements for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "service_capability_requirements_delete_workspace_member" on public.service_capability_requirements for delete to authenticated using (public.is_workspace_member(workspace_id));

-- ---- Instance layer ----
-- event_services itself has no delete policy (never hard-deleted). Every
-- child table below DOES get one — removeEventService performs genuine
-- hard deletes on still-pending/planned generated rows, and unconditional
-- hard deletes on all 6 of these child tables (see
-- core/workflows/eventServiceWorkflow.ts's isGeneratedChecklistItemRemovable/
-- isGeneratedScheduleItemRemovable for the two exceptions, which apply to
-- checklist_items/event_schedule_items, not these tables).

alter table public.event_services enable row level security;
create policy "event_services_select_workspace_member" on public.event_services for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "event_services_insert_workspace_member" on public.event_services for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "event_services_update_workspace_member" on public.event_services for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

alter table public.event_service_inventory_requirements enable row level security;
create policy "event_service_inventory_requirements_select_workspace_member" on public.event_service_inventory_requirements for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "event_service_inventory_requirements_insert_workspace_member" on public.event_service_inventory_requirements for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "event_service_inventory_requirements_update_workspace_member" on public.event_service_inventory_requirements for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "event_service_inventory_requirements_delete_workspace_member" on public.event_service_inventory_requirements for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.event_service_purchase_requirements enable row level security;
create policy "event_service_purchase_requirements_select_workspace_member" on public.event_service_purchase_requirements for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "event_service_purchase_requirements_insert_workspace_member" on public.event_service_purchase_requirements for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "event_service_purchase_requirements_update_workspace_member" on public.event_service_purchase_requirements for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "event_service_purchase_requirements_delete_workspace_member" on public.event_service_purchase_requirements for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.event_service_budget_lines enable row level security;
create policy "event_service_budget_lines_select_workspace_member" on public.event_service_budget_lines for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "event_service_budget_lines_insert_workspace_member" on public.event_service_budget_lines for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "event_service_budget_lines_update_workspace_member" on public.event_service_budget_lines for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "event_service_budget_lines_delete_workspace_member" on public.event_service_budget_lines for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.event_service_team_requirements enable row level security;
create policy "event_service_team_requirements_select_workspace_member" on public.event_service_team_requirements for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "event_service_team_requirements_insert_workspace_member" on public.event_service_team_requirements for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "event_service_team_requirements_update_workspace_member" on public.event_service_team_requirements for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "event_service_team_requirements_delete_workspace_member" on public.event_service_team_requirements for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.event_service_vendor_assignments enable row level security;
create policy "event_service_vendor_assignments_select_workspace_member" on public.event_service_vendor_assignments for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "event_service_vendor_assignments_insert_workspace_member" on public.event_service_vendor_assignments for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "event_service_vendor_assignments_update_workspace_member" on public.event_service_vendor_assignments for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "event_service_vendor_assignments_delete_workspace_member" on public.event_service_vendor_assignments for delete to authenticated using (public.is_workspace_member(workspace_id));

alter table public.event_service_questionnaire_responses enable row level security;
create policy "event_service_questionnaire_responses_select_workspace_member" on public.event_service_questionnaire_responses for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "event_service_questionnaire_responses_insert_workspace_member" on public.event_service_questionnaire_responses for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "event_service_questionnaire_responses_update_workspace_member" on public.event_service_questionnaire_responses for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "event_service_questionnaire_responses_delete_workspace_member" on public.event_service_questionnaire_responses for delete to authenticated using (public.is_workspace_member(workspace_id));
