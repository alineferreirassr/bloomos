import type { Database } from "@/types/database.types";
import type { ServiceCategory } from "@/types/serviceCategory";
import type { Service } from "@/types/service";
import type { ServiceVersion } from "@/types/serviceVersion";
import type { EventService } from "@/types/eventService";
import type { EventServiceInventoryRequirement } from "@/types/eventServiceInventoryRequirement";
import type { EventServicePurchaseRequirement } from "@/types/eventServicePurchaseRequirement";
import type { EventServiceBudgetLine } from "@/types/eventServiceBudgetLine";
import type { EventServiceTeamRequirement } from "@/types/eventServiceTeamRequirement";
import type { EventServiceVendorAssignment } from "@/types/eventServiceVendorAssignment";
import type { EventServiceQuestionnaireResponse } from "@/types/eventServiceQuestionnaireResponse";
import type { EventServiceStatus } from "@/core/enums/eventServiceStatus";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Note } from "@/types/note";
import type { NoteFormInput } from "@/modules/notes/schema";

import { NotFoundError, UnauthorizedError, ForbiddenError, ConflictError } from "@/core/errors";
import { getCoreTimelineService } from "@/core/timeline";
import { getCoreNotesService } from "@/core/notes";
import {
  canTransitionServiceStatus,
  canEditServiceVersionTemplates,
  canEditServiceCatalogFields,
} from "@/core/workflows/serviceWorkflow";
import {
  canTransitionEventServiceStatus,
  canOverrideEventService,
  countsTowardServiceUsage,
  isGeneratedChecklistItemRemovable,
  isGeneratedScheduleItemRemovable,
} from "@/core/workflows/eventServiceWorkflow";

import {
  serviceCategoryInputSchema,
  serviceInputSchema,
  serviceVersionInputSchema,
  publishServiceVersionInputSchema,
  serviceIncludedItemInputSchema,
  serviceAddOnInputSchema,
  serviceChecklistTemplateItemInputSchema,
  serviceTimelineTemplateItemInputSchema,
  serviceQuestionnaireQuestionInputSchema,
  serviceBudgetTemplateLineInputSchema,
  serviceApprovalTemplateItemInputSchema,
  serviceTravelTemplateItemInputSchema,
  serviceAiKnowledgeItemInputSchema,
  serviceRequiredDocumentInputSchema,
  serviceInventoryTemplateItemInputSchema,
  servicePurchaseTemplateItemInputSchema,
  serviceVendorSuggestionInputSchema,
  serviceTeamRoleRequirementInputSchema,
  serviceSeasonalWindowInputSchema,
  serviceCapabilityRequirementInputSchema,
  assignServiceToEventInputSchema,
  eventServiceQuestionnaireResponseInputSchema,
  updateEventServiceOverridesInputSchema,
  type ServiceCategoryInput,
  type ServiceInput,
  type ServiceVersionInput,
  type PublishServiceVersionInput,
  type AssignServiceToEventInput,
  type EventServiceQuestionnaireResponseInput,
  type UpdateEventServiceOverridesInput,
} from "@/modules/services/schema";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import {
  mapServiceCategoryRow,
  mapServiceRow,
  mapServiceVersionRow,
  mapServiceIncludedItemRow,
  mapServiceAddOnRow,
  mapServiceChecklistTemplateItemRow,
  mapServiceTimelineTemplateItemRow,
  mapServiceQuestionnaireQuestionRow,
  mapServiceBudgetTemplateLineRow,
  mapServiceApprovalTemplateItemRow,
  mapServiceTravelTemplateItemRow,
  mapServiceAiKnowledgeItemRow,
  mapServiceRequiredDocumentRow,
  mapServiceInventoryTemplateItemRow,
  mapServicePurchaseTemplateItemRow,
  mapServiceVendorSuggestionRow,
  mapServiceTeamRoleRequirementRow,
  mapServiceSeasonalWindowRow,
  mapServiceCapabilityRequirementRow,
  mapEventServiceRow,
  mapEventServiceInventoryRequirementRow,
  mapEventServicePurchaseRequirementRow,
  mapEventServiceBudgetLineRow,
  mapEventServiceTeamRequirementRow,
  mapEventServiceVendorAssignmentRow,
  mapEventServiceQuestionnaireResponseRow,
  mapChecklistItemRow,
  mapEventScheduleItemRow,
} from "@/lib/supabase/mappers";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import type { ServiceFilters, ServicesRepository } from "@/lib/data/services/repository";
import type { z } from "zod";

/**
 * Defensive-only error codes raised by `publish_service_version` (see
 * supabase/migrations/20260806101700_service_publish_version_function.sql)
 * — surfaced as a user-facing `fail(...)`, never thrown. `P0023` (the draft
 * was no longer a draft by the time the RPC's row lock was acquired — e.g.
 * someone else already published it) is handled separately, as a thrown
 * `ConflictError`, so the Publish dialog can distinguish "someone raced you"
 * from an ordinary validation rejection.
 */
const PUBLISH_ERROR_CODES = new Set(["P0021", "P0022"]);
const PUBLISH_CONFLICT_ERROR_CODE = "P0023";

/** Error codes raised by `assign_service_to_event` (see supabase/migrations/20260806101900_service_assign_to_event_function.sql). */
const ASSIGN_ERROR_CODES = new Set(["P0030", "P0031", "P0032", "P0033"]);

function fieldErrorsFromZod(error: { issues: { path: PropertyKey[]; message: string }[] }): Partial<Record<string, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/** Same rationale as inventory/supabaseRepository.ts's/purchases/supabaseRepository.ts's requireWorkspaceSession. */
async function requireWorkspaceSession(): Promise<WorkspaceSession> {
  const result = await getClientWorkspaceSession();
  if (result.status === "unauthenticated") throw new UnauthorizedError("Authentication is required.");
  if (result.status === "no-workspace") throw new ForbiddenError("You don't have permission to do that.");
  return result.session;
}

function resolveActorName(session: WorkspaceSession): string {
  return session.profile.full_name ?? session.profile.email;
}

async function fetchServiceCategoryRow(id: string): Promise<ServiceCategory | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("service_categories").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapServiceCategoryRow(data) : null;
}

async function fetchServiceRow(id: string): Promise<Service | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("services").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapServiceRow(data) : null;
}

async function fetchServiceVersionRow(id: string): Promise<ServiceVersion | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("service_versions").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapServiceVersionRow(data) : null;
}

async function fetchEventServiceRow(id: string): Promise<EventService | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("event_services").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapEventServiceRow(data) : null;
}

/**
 * One generic CRUD implementation shared by all 16 template-table method
 * pairs — mirrors mockRepository.ts's own createTemplateCrud factory
 * exactly, translated to Supabase queries. Every table's Input schema
 * mirrors its Row's editable fields 1:1, so a single generic
 * insert/update payload needs no per-type variant. Every mutation is
 * rejected once the parent ServiceVersion is no longer "draft"
 * (canEditServiceVersionTemplates) as a friendly-message layer in front of
 * the DB's own `reject_write_to_published_service_version` trigger — the
 * same defense-in-depth relationship the mock repository documents.
 *
 * `deps.table` is a union of the 16 template table names rather than a
 * single literal, so Supabase's typed `.from()`/`.insert()`/`.update()`
 * builders can't narrow to one exact row shape here — the few `as never`/
 * `as TRow`/`as TRow[]` casts below are contained entirely inside this one
 * factory and never leak to a call site, each of which instantiates the
 * factory with its own concrete, fully-typed row/input pair.
 */
function createSupabaseTemplateCrud<TRow extends { id: string; workspace_id: string; service_version_id: string }, TInput extends object>(deps: {
  table:
    | "service_included_items"
    | "service_addons"
    | "service_checklist_template_items"
    | "service_timeline_template_items"
    | "service_questionnaire_questions"
    | "service_budget_template_lines"
    | "service_approval_template_items"
    | "service_travel_template_items"
    | "service_ai_knowledge_items"
    | "service_required_documents"
    | "service_inventory_template_items"
    | "service_purchase_template_items"
    | "service_vendor_suggestions"
    | "service_team_role_requirements"
    | "service_seasonal_windows"
    | "service_capability_requirements";
  schema: z.ZodType<TInput>;
  mapRow: (row: never) => TRow;
  orderColumn?: string;
}) {
  async function fetchRow(id: string): Promise<TRow | null> {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.from(deps.table).select("*").eq("id", id).maybeSingle();
    if (error) throw normalizeSupabaseError(error);
    return data ? deps.mapRow(data as never) : null;
  }

  async function list(serviceVersionId: string): Promise<TRow[]> {
    await requireWorkspaceSession();
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from(deps.table)
      .select("*")
      .eq("service_version_id", serviceVersionId)
      .order(deps.orderColumn ?? "display_order", { ascending: true });
    if (error) throw normalizeSupabaseError(error);
    return (data ?? []).map((row) => deps.mapRow(row as never));
  }

  async function create(serviceVersionId: string, input: TInput): Promise<DataResult<TRow>> {
    const version = await fetchServiceVersionRow(serviceVersionId);
    if (!version) return fail("Service version not found.");
    if (!canEditServiceVersionTemplates(version)) {
      return fail("This version has already been published and can no longer be edited — edit the draft version instead.");
    }
    const parsed = deps.schema.safeParse(input);
    if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

    const session = await requireWorkspaceSession();
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from(deps.table)
      .insert({ workspace_id: session.workspace.id, service_version_id: serviceVersionId, ...parsed.data } as never)
      .select("*")
      .single();
    if (error) throw normalizeSupabaseError(error);
    return ok(deps.mapRow(data as never));
  }

  async function update(id: string, input: TInput): Promise<DataResult<TRow>> {
    const existing = await fetchRow(id);
    if (!existing) return fail("Not found.");
    const version = await fetchServiceVersionRow(existing.service_version_id);
    if (!version || !canEditServiceVersionTemplates(version)) {
      return fail("This version has already been published and can no longer be edited — edit the draft version instead.");
    }
    const parsed = deps.schema.safeParse(input);
    if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

    const supabase = createSupabaseClient();
    const { data, error } = await supabase.from(deps.table).update(parsed.data as never).eq("id", id).select("*").single();
    if (error) throw normalizeSupabaseError(error);
    return ok(deps.mapRow(data as never));
  }

  async function remove(id: string): Promise<DataResult<null>> {
    const existing = await fetchRow(id);
    if (!existing) return fail("Not found.");
    const version = await fetchServiceVersionRow(existing.service_version_id);
    if (!version || !canEditServiceVersionTemplates(version)) {
      return fail("This version has already been published and can no longer be edited — edit the draft version instead.");
    }
    const supabase = createSupabaseClient();
    const { error } = await supabase.from(deps.table).delete().eq("id", id);
    if (error) throw normalizeSupabaseError(error);
    return ok(null);
  }

  return { list, create, update, remove };
}

const includedItemsCrud = createSupabaseTemplateCrud({ table: "service_included_items", schema: serviceIncludedItemInputSchema, mapRow: mapServiceIncludedItemRow });
const addOnsCrud = createSupabaseTemplateCrud({ table: "service_addons", schema: serviceAddOnInputSchema, mapRow: mapServiceAddOnRow });
const checklistTemplateItemsCrud = createSupabaseTemplateCrud({ table: "service_checklist_template_items", schema: serviceChecklistTemplateItemInputSchema, mapRow: mapServiceChecklistTemplateItemRow });
const timelineTemplateItemsCrud = createSupabaseTemplateCrud({ table: "service_timeline_template_items", schema: serviceTimelineTemplateItemInputSchema, mapRow: mapServiceTimelineTemplateItemRow });
const questionnaireQuestionsCrud = createSupabaseTemplateCrud({ table: "service_questionnaire_questions", schema: serviceQuestionnaireQuestionInputSchema, mapRow: mapServiceQuestionnaireQuestionRow });
const budgetTemplateLinesCrud = createSupabaseTemplateCrud({ table: "service_budget_template_lines", schema: serviceBudgetTemplateLineInputSchema, mapRow: mapServiceBudgetTemplateLineRow });
const approvalTemplateItemsCrud = createSupabaseTemplateCrud({ table: "service_approval_template_items", schema: serviceApprovalTemplateItemInputSchema, mapRow: mapServiceApprovalTemplateItemRow });
const travelTemplateItemsCrud = createSupabaseTemplateCrud({ table: "service_travel_template_items", schema: serviceTravelTemplateItemInputSchema, mapRow: mapServiceTravelTemplateItemRow });
const aiKnowledgeItemsCrud = createSupabaseTemplateCrud({ table: "service_ai_knowledge_items", schema: serviceAiKnowledgeItemInputSchema, mapRow: mapServiceAiKnowledgeItemRow });
const requiredDocumentsCrud = createSupabaseTemplateCrud({ table: "service_required_documents", schema: serviceRequiredDocumentInputSchema, mapRow: mapServiceRequiredDocumentRow });
const inventoryTemplateItemsCrud = createSupabaseTemplateCrud({ table: "service_inventory_template_items", schema: serviceInventoryTemplateItemInputSchema, mapRow: mapServiceInventoryTemplateItemRow });
const purchaseTemplateItemsCrud = createSupabaseTemplateCrud({ table: "service_purchase_template_items", schema: servicePurchaseTemplateItemInputSchema, mapRow: mapServicePurchaseTemplateItemRow });
const vendorSuggestionsCrud = createSupabaseTemplateCrud({ table: "service_vendor_suggestions", schema: serviceVendorSuggestionInputSchema, mapRow: mapServiceVendorSuggestionRow });
const teamRoleRequirementsCrud = createSupabaseTemplateCrud({ table: "service_team_role_requirements", schema: serviceTeamRoleRequirementInputSchema, mapRow: mapServiceTeamRoleRequirementRow });
// No display_order column on this table — ordered by start_month instead (see 20260806100600_service_resource_templates.sql).
const seasonalWindowsCrud = createSupabaseTemplateCrud({ table: "service_seasonal_windows", schema: serviceSeasonalWindowInputSchema, mapRow: mapServiceSeasonalWindowRow, orderColumn: "start_month" });
const capabilityRequirementsCrud = createSupabaseTemplateCrud({ table: "service_capability_requirements", schema: serviceCapabilityRequirementInputSchema, mapRow: mapServiceCapabilityRequirementRow });

// ---- Service Categories ----

async function listServiceCategories(includeArchived = false): Promise<ServiceCategory[]> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  let query = supabase.from("service_categories").select("*").eq("workspace_id", session.workspace.id);
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query.order("display_order", { ascending: true });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapServiceCategoryRow);
}

async function createServiceCategory(input: ServiceCategoryInput): Promise<DataResult<ServiceCategory>> {
  const parsed = serviceCategoryInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("service_categories").insert({ workspace_id: session.workspace.id, ...parsed.data }).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapServiceCategoryRow(data));
}

async function updateServiceCategory(id: string, input: ServiceCategoryInput): Promise<DataResult<ServiceCategory>> {
  const existing = await fetchServiceCategoryRow(id);
  if (!existing) return fail("Service category not found.");
  const parsed = serviceCategoryInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("service_categories").update({ ...parsed.data }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapServiceCategoryRow(data));
}

async function archiveServiceCategory(id: string): Promise<DataResult<ServiceCategory>> {
  const existing = await fetchServiceCategoryRow(id);
  if (!existing) return fail("Service category not found.");
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("service_categories").update({ archived_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapServiceCategoryRow(data));
}

// ---- Services (catalog identity) ----

async function listServices(filters: ServiceFilters = {}): Promise<Service[]> {
  const session = await requireWorkspaceSession();
  const { status, categoryId, includeArchived = false, search } = filters;
  const supabase = createSupabaseClient();
  let query = supabase.from("services").select("*").eq("workspace_id", session.workspace.id);
  if (!includeArchived) query = query.neq("status", "archived");
  if (status && status !== "all") query = query.eq("status", status);
  if (categoryId && categoryId !== "all") query = query.eq("category_id", categoryId);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  const services = (data ?? []).map(mapServiceRow);

  const q = search?.trim().toLowerCase();
  if (!q) return services;
  return services.filter((service) => service.name.toLowerCase().includes(q));
}

async function getService(id: string): Promise<Service> {
  const service = await fetchServiceRow(id);
  if (!service) throw new NotFoundError(`Service ${id} was not found`);
  return service;
}

/**
 * Creates the Service row, then its one always-present draft ServiceVersion,
 * then repoints draft_version_id at it — three sequential calls rather than
 * one RPC, mirroring the same circular-FK resolution the migrations
 * themselves use (services.draft_version_id has no FK until service_versions
 * exists). No RPC was built for this path (unlike publish/assign) — a
 * disclosed, narrow gap: if this process is interrupted between steps, a
 * Service could persist with no draft yet. Low-severity (nothing else reads
 * a Service before its draft exists) and easy to detect/retry.
 */
async function createService(input: ServiceInput): Promise<DataResult<Service>> {
  const parsed = serviceInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data: serviceData, error: serviceError } = await supabase
    .from("services")
    .insert({ workspace_id: session.workspace.id, category_id: parsed.data.category_id, name: parsed.data.name, description: parsed.data.description, status: "draft" })
    .select("*")
    .single();
  if (serviceError) throw normalizeSupabaseError(serviceError);

  const { data: versionData, error: versionError } = await supabase
    .from("service_versions")
    .insert({ service_id: serviceData.id, workspace_id: session.workspace.id, status: "draft" })
    .select("*")
    .single();
  if (versionError) throw normalizeSupabaseError(versionError);

  const { data: updatedServiceData, error: updateError } = await supabase
    .from("services")
    .update({ draft_version_id: versionData.id })
    .eq("id", serviceData.id)
    .select("*")
    .single();
  if (updateError) throw normalizeSupabaseError(updateError);

  const service = mapServiceRow(updatedServiceData);
  await getCoreTimelineService(supabase).recordActivity(service.workspace_id, "service", service.id, actor, "service_created", `Service created: "${service.name}"`);
  return ok(service);
}

async function updateService(id: string, input: ServiceInput): Promise<DataResult<Service>> {
  const existing = await fetchServiceRow(id);
  if (!existing) return fail("Service not found.");
  if (!canEditServiceCatalogFields(existing)) return fail("An archived Service cannot be edited. Restore it first.");
  const parsed = serviceInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("services")
    .update({ category_id: parsed.data.category_id, name: parsed.data.name, description: parsed.data.description })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapServiceRow(data);
  await getCoreTimelineService(supabase).recordActivity(updated.workspace_id, "service", id, actor, "service_updated", "Service updated");
  return ok(updated);
}

async function transitionService(id: string, to: Service["status"]): Promise<DataResult<Service>> {
  const existing = await fetchServiceRow(id);
  if (!existing) return fail("Service not found.");
  if (!canTransitionServiceStatus(existing.status, to)) return fail("That status change isn't allowed here.");

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();

  const { data, error } = await supabase
    .from("services")
    .update({ status: to, archived_at: to === "archived" ? timestamp : null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapServiceRow(data);
  await getCoreTimelineService(supabase).recordActivity(updated.workspace_id, "service", id, actor, "service_status_changed", `Service status changed to "${to}"`, { from: existing.status, to });
  return ok(updated);
}

async function activateService(id: string): Promise<DataResult<Service>> {
  return transitionService(id, "active");
}
async function deactivateService(id: string): Promise<DataResult<Service>> {
  return transitionService(id, "inactive");
}
async function archiveService(id: string): Promise<DataResult<Service>> {
  return transitionService(id, "archived");
}
async function restoreService(id: string): Promise<DataResult<Service>> {
  return transitionService(id, "draft");
}

// ---- Service Versions ----

async function listServiceVersions(serviceId: string): Promise<ServiceVersion[]> {
  await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  // Postgres defaults DESC to NULLS FIRST, so the one draft (version_number
  // null) always sorts first — matching the mock repository's own
  // `(b.version_number ?? Infinity) - (a.version_number ?? Infinity)` sort.
  const { data, error } = await supabase.from("service_versions").select("*").eq("service_id", serviceId).order("version_number", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapServiceVersionRow);
}

async function getServiceVersion(id: string): Promise<ServiceVersion> {
  const version = await fetchServiceVersionRow(id);
  if (!version) throw new NotFoundError(`Service version ${id} was not found`);
  return version;
}

async function updateServiceVersionDraft(serviceId: string, input: ServiceVersionInput): Promise<DataResult<ServiceVersion>> {
  const service = await fetchServiceRow(serviceId);
  if (!service || !service.draft_version_id) return fail("Service not found.");
  const draft = await fetchServiceVersionRow(service.draft_version_id);
  if (!draft) return fail("Draft version not found.");
  if (!canEditServiceVersionTemplates(draft)) return fail("This version is no longer editable.");

  const parsed = serviceVersionInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("service_versions").update({ ...parsed.data }).eq("id", draft.id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapServiceVersionRow(data));
}

/**
 * Thin wrapper around the atomic `publish_service_version` RPC (see
 * supabase/migrations/20260806101700_service_publish_version_function.sql)
 * — that function IS the SQL-side equivalent of the mock repository's own
 * publishServiceVersion, not a second, divergent implementation. This
 * method therefore does no pre-validation of its own beyond input shape.
 */
async function publishServiceVersion(serviceId: string, input: PublishServiceVersionInput): Promise<DataResult<ServiceVersion>> {
  const parsed = publishServiceVersionInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("publish_service_version", {
    p_service_id: serviceId,
    p_change_summary: parsed.data.change_summary,
    p_actor: actor,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === PUBLISH_CONFLICT_ERROR_CODE) throw new ConflictError(error.message);
    if (code && PUBLISH_ERROR_CODES.has(code)) return fail(error.message);
    throw normalizeSupabaseError(error);
  }
  return ok(mapServiceVersionRow(data as Database["public"]["Tables"]["service_versions"]["Row"]));
}

// ---- EventService (Instance layer) ----

async function listEventServicesByEvent(eventId: string): Promise<EventService[]> {
  await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("event_services").select("*").eq("event_id", eventId).order("assigned_at", { ascending: true });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapEventServiceRow);
}

async function listEventServicesByService(serviceId: string): Promise<EventService[]> {
  await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("event_services").select("*").eq("service_id", serviceId).order("assigned_at", { ascending: true });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapEventServiceRow);
}

/**
 * One round trip for the whole page of Service ids, never one query per
 * row. PostgREST/supabase-js has no `GROUP BY` aggregation in its query
 * builder, so this fetches only the `service_id`/`status` columns for the
 * matching rows and counts them in memory — still a single query, and a
 * genuine schema-free way to satisfy this contract (a dedicated count RPC
 * would also work, but isn't needed: the current schema already supports
 * this without a migration). `.eq("workspace_id", ...)` is explicit
 * defense-in-depth on top of RLS, matching every other query in this file.
 */
async function getServiceUsageCounts(serviceIds: string[]): Promise<Record<string, number>> {
  if (serviceIds.length === 0) return {};
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("event_services")
    .select("service_id, status")
    .eq("workspace_id", session.workspace.id)
    .in("service_id", serviceIds);
  if (error) throw normalizeSupabaseError(error);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (!countsTowardServiceUsage(row.status as EventServiceStatus)) continue;
    counts[row.service_id] = (counts[row.service_id] ?? 0) + 1;
  }
  return counts;
}

async function getEventService(id: string): Promise<EventService> {
  const eventService = await fetchEventServiceRow(id);
  if (!eventService) throw new NotFoundError(`EventService ${id} was not found`);
  return eventService;
}

/**
 * Thin wrapper around the atomic `assign_service_to_event` RPC (see
 * supabase/migrations/20260806101900_service_assign_to_event_function.sql)
 * — that function generates the EventService row, the real checklist_items/
 * event_schedule_items rows, and all five Instance-layer requirement/
 * assignment child tables in one transaction. `canAssignService` is not
 * re-checked here — the RPC's own P0032 covers exactly that condition with
 * the same message.
 */
async function assignServiceToEvent(eventId: string, input: AssignServiceToEventInput): Promise<DataResult<EventService>> {
  const parsed = assignServiceToEventInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("assign_service_to_event", {
    p_event_id: eventId,
    p_service_id: parsed.data.service_id,
    p_selected_add_on_ids: parsed.data.selected_add_on_ids,
    p_actor: actor,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code && ASSIGN_ERROR_CODES.has(code)) return fail(error.message);
    throw normalizeSupabaseError(error);
  }
  return ok(mapEventServiceRow(data as Database["public"]["Tables"]["event_services"]["Row"]));
}

/**
 * The 6 instance-child requirement/assignment tables all cascade-delete
 * automatically via their `event_service_id` FK (see
 * 20260806100800_event_services.sql's sibling migrations) once the
 * `event_services` row itself is deleted below. Only checklist_items/
 * event_schedule_items need explicit handling here — their FK is
 * `on delete set null`, not cascade (a non-removable item, e.g. one already
 * completed, deliberately outlives its source EventService), so only the
 * still-removable rows are deleted; everything else is left with
 * `source_event_service_id` nulled out automatically by Postgres.
 */
async function removeEventService(id: string): Promise<DataResult<null>> {
  const existing = await fetchEventServiceRow(id);
  if (!existing) return fail("Not found.");

  const supabase = createSupabaseClient();

  const { data: checklistRows, error: checklistError } = await supabase.from("checklist_items").select("*").eq("source_event_service_id", id);
  if (checklistError) throw normalizeSupabaseError(checklistError);
  const removableChecklistIds = (checklistRows ?? [])
    .map(mapChecklistItemRow)
    .filter((item) => isGeneratedChecklistItemRemovable(item.status))
    .map((item) => item.id);
  if (removableChecklistIds.length > 0) {
    const { error } = await supabase.from("checklist_items").delete().in("id", removableChecklistIds);
    if (error) throw normalizeSupabaseError(error);
  }

  const { data: scheduleRows, error: scheduleError } = await supabase.from("event_schedule_items").select("*").eq("source_event_service_id", id);
  if (scheduleError) throw normalizeSupabaseError(scheduleError);
  const removableScheduleIds = (scheduleRows ?? [])
    .map(mapEventScheduleItemRow)
    .filter((item) => isGeneratedScheduleItemRemovable(item.status))
    .map((item) => item.id);
  if (removableScheduleIds.length > 0) {
    const { error } = await supabase.from("event_schedule_items").delete().in("id", removableScheduleIds);
    if (error) throw normalizeSupabaseError(error);
  }

  const { error } = await supabase.from("event_services").delete().eq("id", id);
  if (error) throw normalizeSupabaseError(error);

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  await getCoreTimelineService(supabase).recordActivity(existing.workspace_id, "event", existing.event_id, actor, "event_service_removed", `Service "${existing.name}" removed from this Event`);
  return ok(null);
}

async function transitionEventServiceStatus(id: string, to: EventServiceStatus): Promise<DataResult<EventService>> {
  const existing = await fetchEventServiceRow(id);
  if (!existing) return fail("Not found.");
  if (!canTransitionEventServiceStatus(existing.status, to)) return fail("That status change isn't allowed here.");

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.from("event_services").update({ status: to }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapEventServiceRow(data);
  await getCoreTimelineService(supabase).recordActivity(updated.workspace_id, "event_service", id, actor, "event_service_status_changed", `Status changed to "${to}"`, { from: existing.status, to });
  return ok(updated);
}

/**
 * Only ever writes `name`/`price_minor` — `name_template_value`/
 * `price_template_value`/`service_version_id` are never part of the update
 * payload built below, so they cannot be touched by this call regardless
 * of what `input` contains (the zod schema already restricts `input`'s
 * shape to just these two optional fields, but the payload is still built
 * field-by-field here rather than spreading `input` directly, so a future
 * schema change could never silently widen what this call is allowed to
 * write).
 */
async function updateEventServiceOverrides(id: string, input: UpdateEventServiceOverridesInput): Promise<DataResult<EventService>> {
  const existing = await fetchEventServiceRow(id);
  if (!existing) return fail("Not found.");
  if (!canOverrideEventService(existing.status)) {
    return fail("This Service's overrides can no longer be edited once it is completed or cancelled.");
  }
  const parsed = updateEventServiceOverridesInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  const updatePayload: Database["public"]["Tables"]["event_services"]["Update"] = {};
  if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
  if (parsed.data.price_minor !== undefined) updatePayload.price_minor = parsed.data.price_minor;

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("event_services").update(updatePayload).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapEventServiceRow(data));
}

async function listEventServiceInventoryRequirements(eventServiceId: string): Promise<EventServiceInventoryRequirement[]> {
  await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("event_service_inventory_requirements").select("*").eq("event_service_id", eventServiceId);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapEventServiceInventoryRequirementRow);
}

async function fulfillEventServiceInventoryRequirement(id: string): Promise<DataResult<EventServiceInventoryRequirement>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("event_service_inventory_requirements").update({ is_fulfilled: true }).eq("id", id).select("*").maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) return fail("Not found.");
  return ok(mapEventServiceInventoryRequirementRow(data));
}

async function listEventServicePurchaseRequirements(eventServiceId: string): Promise<EventServicePurchaseRequirement[]> {
  await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("event_service_purchase_requirements").select("*").eq("event_service_id", eventServiceId);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapEventServicePurchaseRequirementRow);
}

async function linkEventServicePurchaseRequirementToPurchase(id: string, purchaseId: string): Promise<DataResult<EventServicePurchaseRequirement>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("event_service_purchase_requirements").update({ fulfilled_purchase_id: purchaseId }).eq("id", id).select("*").maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) return fail("Not found.");
  return ok(mapEventServicePurchaseRequirementRow(data));
}

async function listEventServiceBudgetLines(eventServiceId: string): Promise<EventServiceBudgetLine[]> {
  await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("event_service_budget_lines").select("*").eq("event_service_id", eventServiceId);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapEventServiceBudgetLineRow);
}

async function listEventServiceTeamRequirements(eventServiceId: string): Promise<EventServiceTeamRequirement[]> {
  await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("event_service_team_requirements").select("*").eq("event_service_id", eventServiceId);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapEventServiceTeamRequirementRow);
}

async function listEventServiceVendorAssignments(eventServiceId: string): Promise<EventServiceVendorAssignment[]> {
  await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("event_service_vendor_assignments").select("*").eq("event_service_id", eventServiceId);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapEventServiceVendorAssignmentRow);
}

async function setVendorAssignmentStatus(id: string, status: EventServiceVendorAssignment["status"]): Promise<DataResult<EventServiceVendorAssignment>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("event_service_vendor_assignments").update({ status }).eq("id", id).select("*").maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) return fail("Not found.");
  return ok(mapEventServiceVendorAssignmentRow(data));
}
async function confirmEventServiceVendorAssignment(id: string): Promise<DataResult<EventServiceVendorAssignment>> {
  return setVendorAssignmentStatus(id, "confirmed");
}
async function declineEventServiceVendorAssignment(id: string): Promise<DataResult<EventServiceVendorAssignment>> {
  return setVendorAssignmentStatus(id, "declined");
}

async function listEventServiceQuestionnaireResponses(eventServiceId: string): Promise<EventServiceQuestionnaireResponse[]> {
  await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("event_service_questionnaire_responses").select("*").eq("event_service_id", eventServiceId);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapEventServiceQuestionnaireResponseRow);
}

/** Upserts on the real `event_service_questionnaire_responses_unique (event_service_id, question_id)` constraint — a single round trip covering both "first answer" and "changed answer" rather than the mock repository's manual check-then-branch. */
async function submitEventServiceQuestionnaireResponse(eventServiceId: string, input: EventServiceQuestionnaireResponseInput): Promise<DataResult<EventServiceQuestionnaireResponse>> {
  const parsed = eventServiceQuestionnaireResponseInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("event_service_questionnaire_responses")
    .upsert({ workspace_id: session.workspace.id, event_service_id: eventServiceId, ...parsed.data }, { onConflict: "event_service_id,question_id" })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapEventServiceQuestionnaireResponseRow(data));
}

// ---- Notes/Timeline delegation ----

async function getTimelineByServiceId(serviceId: string): Promise<TimelineActivity[]> {
  const service = await fetchServiceRow(serviceId);
  if (!service) return [];
  const supabase = createSupabaseClient();
  return getCoreTimelineService(supabase).getTimelineForOwner(service.workspace_id, "service", serviceId);
}
async function getNotesByServiceId(serviceId: string): Promise<Note[]> {
  const service = await fetchServiceRow(serviceId);
  if (!service) return [];
  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).getNotesForOwner(service.workspace_id, "service", serviceId);
}
async function createServiceNote(serviceId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const service = await fetchServiceRow(serviceId);
  if (!service) return fail("Service not found.");
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).createNoteForOwner(service.workspace_id, "service", serviceId, resolveActorName(session), input);
}
async function updateServiceNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note> | null> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).updateNoteById(session.workspace.id, noteId, resolveActorName(session), input);
}
async function toggleServiceNotePin(noteId: string): Promise<DataResult<Note> | null> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).togglePinNoteById(session.workspace.id, noteId, resolveActorName(session));
}

async function getTimelineByEventServiceId(eventServiceId: string): Promise<TimelineActivity[]> {
  const eventService = await fetchEventServiceRow(eventServiceId);
  if (!eventService) return [];
  const supabase = createSupabaseClient();
  return getCoreTimelineService(supabase).getTimelineForOwner(eventService.workspace_id, "event_service", eventServiceId);
}
async function getNotesByEventServiceId(eventServiceId: string): Promise<Note[]> {
  const eventService = await fetchEventServiceRow(eventServiceId);
  if (!eventService) return [];
  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).getNotesForOwner(eventService.workspace_id, "event_service", eventServiceId);
}
async function createEventServiceNote(eventServiceId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const eventService = await fetchEventServiceRow(eventServiceId);
  if (!eventService) return fail("EventService not found.");
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).createNoteForOwner(eventService.workspace_id, "event_service", eventServiceId, resolveActorName(session), input);
}
async function updateEventServiceNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note> | null> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).updateNoteById(session.workspace.id, noteId, resolveActorName(session), input);
}
async function toggleEventServiceNotePin(noteId: string): Promise<DataResult<Note> | null> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).togglePinNoteById(session.workspace.id, noteId, resolveActorName(session));
}

export const supabaseServicesRepository: ServicesRepository = {
  listServiceCategories,
  createServiceCategory,
  updateServiceCategory,
  archiveServiceCategory,

  listServices,
  getService,
  createService,
  updateService,
  activateService,
  deactivateService,
  archiveService,
  restoreService,

  listServiceVersions,
  getServiceVersion,
  updateServiceVersionDraft,
  publishServiceVersion,

  listServiceIncludedItems: includedItemsCrud.list,
  createServiceIncludedItem: includedItemsCrud.create,
  updateServiceIncludedItem: includedItemsCrud.update,
  removeServiceIncludedItem: includedItemsCrud.remove,

  listServiceAddOns: addOnsCrud.list,
  createServiceAddOn: addOnsCrud.create,
  updateServiceAddOn: addOnsCrud.update,
  removeServiceAddOn: addOnsCrud.remove,

  listServiceChecklistTemplateItems: checklistTemplateItemsCrud.list,
  createServiceChecklistTemplateItem: checklistTemplateItemsCrud.create,
  updateServiceChecklistTemplateItem: checklistTemplateItemsCrud.update,
  removeServiceChecklistTemplateItem: checklistTemplateItemsCrud.remove,

  listServiceTimelineTemplateItems: timelineTemplateItemsCrud.list,
  createServiceTimelineTemplateItem: timelineTemplateItemsCrud.create,
  updateServiceTimelineTemplateItem: timelineTemplateItemsCrud.update,
  removeServiceTimelineTemplateItem: timelineTemplateItemsCrud.remove,

  listServiceQuestionnaireQuestions: questionnaireQuestionsCrud.list,
  createServiceQuestionnaireQuestion: questionnaireQuestionsCrud.create,
  updateServiceQuestionnaireQuestion: questionnaireQuestionsCrud.update,
  removeServiceQuestionnaireQuestion: questionnaireQuestionsCrud.remove,

  listServiceBudgetTemplateLines: budgetTemplateLinesCrud.list,
  createServiceBudgetTemplateLine: budgetTemplateLinesCrud.create,
  updateServiceBudgetTemplateLine: budgetTemplateLinesCrud.update,
  removeServiceBudgetTemplateLine: budgetTemplateLinesCrud.remove,

  listServiceApprovalTemplateItems: approvalTemplateItemsCrud.list,
  createServiceApprovalTemplateItem: approvalTemplateItemsCrud.create,
  updateServiceApprovalTemplateItem: approvalTemplateItemsCrud.update,
  removeServiceApprovalTemplateItem: approvalTemplateItemsCrud.remove,

  listServiceTravelTemplateItems: travelTemplateItemsCrud.list,
  createServiceTravelTemplateItem: travelTemplateItemsCrud.create,
  updateServiceTravelTemplateItem: travelTemplateItemsCrud.update,
  removeServiceTravelTemplateItem: travelTemplateItemsCrud.remove,

  listServiceAiKnowledgeItems: aiKnowledgeItemsCrud.list,
  createServiceAiKnowledgeItem: aiKnowledgeItemsCrud.create,
  updateServiceAiKnowledgeItem: aiKnowledgeItemsCrud.update,
  removeServiceAiKnowledgeItem: aiKnowledgeItemsCrud.remove,

  listServiceRequiredDocuments: requiredDocumentsCrud.list,
  createServiceRequiredDocument: requiredDocumentsCrud.create,
  updateServiceRequiredDocument: requiredDocumentsCrud.update,
  removeServiceRequiredDocument: requiredDocumentsCrud.remove,

  listServiceInventoryTemplateItems: inventoryTemplateItemsCrud.list,
  createServiceInventoryTemplateItem: inventoryTemplateItemsCrud.create,
  updateServiceInventoryTemplateItem: inventoryTemplateItemsCrud.update,
  removeServiceInventoryTemplateItem: inventoryTemplateItemsCrud.remove,

  listServicePurchaseTemplateItems: purchaseTemplateItemsCrud.list,
  createServicePurchaseTemplateItem: purchaseTemplateItemsCrud.create,
  updateServicePurchaseTemplateItem: purchaseTemplateItemsCrud.update,
  removeServicePurchaseTemplateItem: purchaseTemplateItemsCrud.remove,

  listServiceVendorSuggestions: vendorSuggestionsCrud.list,
  createServiceVendorSuggestion: vendorSuggestionsCrud.create,
  updateServiceVendorSuggestion: vendorSuggestionsCrud.update,
  removeServiceVendorSuggestion: vendorSuggestionsCrud.remove,

  listServiceTeamRoleRequirements: teamRoleRequirementsCrud.list,
  createServiceTeamRoleRequirement: teamRoleRequirementsCrud.create,
  updateServiceTeamRoleRequirement: teamRoleRequirementsCrud.update,
  removeServiceTeamRoleRequirement: teamRoleRequirementsCrud.remove,

  listServiceSeasonalWindows: seasonalWindowsCrud.list,
  createServiceSeasonalWindow: seasonalWindowsCrud.create,
  updateServiceSeasonalWindow: seasonalWindowsCrud.update,
  removeServiceSeasonalWindow: seasonalWindowsCrud.remove,

  listServiceCapabilityRequirements: capabilityRequirementsCrud.list,
  createServiceCapabilityRequirement: capabilityRequirementsCrud.create,
  updateServiceCapabilityRequirement: capabilityRequirementsCrud.update,
  removeServiceCapabilityRequirement: capabilityRequirementsCrud.remove,

  listEventServicesByEvent,
  listEventServicesByService,
  getEventService,
  assignServiceToEvent,
  removeEventService,
  transitionEventServiceStatus,
  updateEventServiceOverrides,
  getServiceUsageCounts,

  listEventServiceInventoryRequirements,
  fulfillEventServiceInventoryRequirement,

  listEventServicePurchaseRequirements,
  linkEventServicePurchaseRequirementToPurchase,

  listEventServiceBudgetLines,
  listEventServiceTeamRequirements,

  listEventServiceVendorAssignments,
  confirmEventServiceVendorAssignment,
  declineEventServiceVendorAssignment,

  listEventServiceQuestionnaireResponses,
  submitEventServiceQuestionnaireResponse,

  getTimelineByServiceId,
  getNotesByServiceId,
  createServiceNote,
  updateServiceNote,
  toggleServiceNotePin,

  getTimelineByEventServiceId,
  getNotesByEventServiceId,
  createEventServiceNote,
  updateEventServiceNote,
  toggleEventServiceNotePin,
};
