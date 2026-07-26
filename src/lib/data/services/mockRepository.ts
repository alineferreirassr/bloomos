import type { ServiceCategory } from "@/types/serviceCategory";
import type { Service } from "@/types/service";
import type { ServiceVersion } from "@/types/serviceVersion";
import type { EventService } from "@/types/eventService";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Note } from "@/types/note";
import type { NoteFormInput } from "@/modules/notes/schema";
import type { ChecklistItem } from "@/types/checklistItem";
import type { EventScheduleItem } from "@/types/eventScheduleItem";
import type { EventServiceInventoryRequirement } from "@/types/eventServiceInventoryRequirement";
import type { EventServicePurchaseRequirement } from "@/types/eventServicePurchaseRequirement";
import type { EventServiceBudgetLine } from "@/types/eventServiceBudgetLine";
import type { EventServiceTeamRequirement } from "@/types/eventServiceTeamRequirement";
import type { EventServiceVendorAssignment } from "@/types/eventServiceVendorAssignment";
import type { EventServiceQuestionnaireResponse } from "@/types/eventServiceQuestionnaireResponse";

import { NotFoundError } from "@/core/errors";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { CURRENT_ACTOR } from "@/core/constants/actor";
import { generateId, nowIso, delay } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { getCoreTimelineService, registerTimelineActivityType } from "@/core/timeline";
import { getCoreNotesService } from "@/core/notes";

import {
  readServiceCategories,
  writeServiceCategories,
  readServices,
  writeServices,
  readServiceVersions,
  writeServiceVersions,
} from "@/lib/data/mock/servicesStore";
import {
  readServiceIncludedItems,
  writeServiceIncludedItems,
  readServiceAddOns,
  writeServiceAddOns,
  readServiceChecklistTemplateItems,
  writeServiceChecklistTemplateItems,
  readServiceTimelineTemplateItems,
  writeServiceTimelineTemplateItems,
  readServiceQuestionnaireQuestions,
  writeServiceQuestionnaireQuestions,
  readServiceBudgetTemplateLines,
  writeServiceBudgetTemplateLines,
  readServiceApprovalTemplateItems,
  writeServiceApprovalTemplateItems,
  readServiceTravelTemplateItems,
  writeServiceTravelTemplateItems,
  readServiceAiKnowledgeItems,
  writeServiceAiKnowledgeItems,
  readServiceRequiredDocuments,
  writeServiceRequiredDocuments,
  readServiceInventoryTemplateItems,
  writeServiceInventoryTemplateItems,
  readServicePurchaseTemplateItems,
  writeServicePurchaseTemplateItems,
  readServiceVendorSuggestions,
  writeServiceVendorSuggestions,
  readServiceTeamRoleRequirements,
  writeServiceTeamRoleRequirements,
  readServiceSeasonalWindows,
  writeServiceSeasonalWindows,
  readServiceCapabilityRequirements,
  writeServiceCapabilityRequirements,
} from "@/lib/data/mock/serviceTemplatesStore";
import {
  readEventServices,
  writeEventServices,
  readEventServiceInventoryRequirements,
  writeEventServiceInventoryRequirements,
  readEventServicePurchaseRequirements,
  writeEventServicePurchaseRequirements,
  readEventServiceBudgetLines,
  writeEventServiceBudgetLines,
  readEventServiceTeamRequirements,
  writeEventServiceTeamRequirements,
  readEventServiceVendorAssignments,
  writeEventServiceVendorAssignments,
  readEventServiceQuestionnaireResponses,
  writeEventServiceQuestionnaireResponses,
} from "@/lib/data/mock/eventServicesStore";
import { readChecklistItems, writeChecklistItems } from "@/lib/data/mock/checklistStore";
import { readScheduleItems, writeScheduleItems } from "@/lib/data/mock/scheduleStore";
import { readEvents } from "@/lib/data/mock/eventsStore";

import {
  canTransitionServiceStatus,
  canAssignService,
  canEditServiceVersionTemplates,
  canEditServiceCatalogFields,
  computeNextServiceVersionNumber,
  canPublishServiceVersion,
} from "@/core/workflows/serviceWorkflow";
import {
  canTransitionEventServiceStatus,
  canOverrideEventService,
  countsTowardServiceUsage,
  isGeneratedChecklistItemRemovable,
  isGeneratedScheduleItemRemovable,
  buildEventServiceAssignmentPlan,
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
import type { ServiceFilters, ServicesRepository } from "@/lib/data/services/repository";
import type { z } from "zod";

// Registers Services' own Timeline vocabulary via the Core registry, same
// "register without modifying Core" path Inventory/Purchases/Vendors use.
// Scoped to the meaningful catalog/instance-level events only — individual
// template-row edits (checklist/timeline/questionnaire/... template items)
// are NOT individually Timeline-logged in this Foundation phase, the same
// deliberate scope reduction documented in docs/services.md.
registerTimelineActivityType("service_created", "Service created");
registerTimelineActivityType("service_updated", "Service updated");
registerTimelineActivityType("service_status_changed", "Service status changed");
registerTimelineActivityType("service_version_published", "Service version published");
registerTimelineActivityType("event_service_assigned", "Service assigned to Event");
registerTimelineActivityType("event_service_status_changed", "Assigned Service status changed");
registerTimelineActivityType("event_service_removed", "Service removed from Event");

function fieldErrorsFromZod(error: { issues: { path: PropertyKey[]; message: string }[] }): Partial<Record<string, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

function findServiceCategoryRow(id: string): ServiceCategory | null {
  return readServiceCategories().find((c) => c.id === id && c.workspace_id === CURRENT_WORKSPACE_ID) ?? null;
}
function findServiceRow(id: string): Service | null {
  return readServices().find((s) => s.id === id && s.workspace_id === CURRENT_WORKSPACE_ID) ?? null;
}
function findServiceVersionRow(id: string): ServiceVersion | null {
  return readServiceVersions().find((v) => v.id === id && v.workspace_id === CURRENT_WORKSPACE_ID) ?? null;
}
function findEventServiceRow(id: string): EventService | null {
  return readEventServices().find((e) => e.id === id && e.workspace_id === CURRENT_WORKSPACE_ID) ?? null;
}

/**
 * One generic CRUD implementation shared by all 17 template-table method
 * pairs — every template row's Input schema mirrors its Row's editable
 * fields 1:1 (id/workspace_id/service_version_id/timestamps aside), so a
 * single generic buildRow/applyInput needs no per-type variant. Every
 * operation is rejected once the parent ServiceVersion is no longer
 * "draft" (canEditServiceVersionTemplates) — the one business rule this
 * factory enforces uniformly rather than 17 separate times.
 */
function createTemplateCrud<TRow extends { id: string; workspace_id: string; service_version_id: string; created_at: string; updated_at: string }, TInput extends object>(deps: {
  read: () => TRow[];
  write: (rows: TRow[]) => void;
  idPrefix: string;
  schema: z.ZodType<TInput>;
}) {
  function findRow(id: string): TRow | null {
    return deps.read().find((r) => r.id === id && r.workspace_id === CURRENT_WORKSPACE_ID) ?? null;
  }

  async function list(serviceVersionId: string): Promise<TRow[]> {
    await delay(100);
    return deps.read().filter((r) => r.workspace_id === CURRENT_WORKSPACE_ID && r.service_version_id === serviceVersionId);
  }

  async function create(serviceVersionId: string, input: TInput): Promise<DataResult<TRow>> {
    const version = findServiceVersionRow(serviceVersionId);
    if (!version) return fail("Service version not found.");
    if (!canEditServiceVersionTemplates(version)) {
      return fail("This version has already been published and can no longer be edited — edit the draft version instead.");
    }
    const parsed = deps.schema.safeParse(input);
    if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

    const now = nowIso();
    const row = {
      id: generateId(deps.idPrefix),
      workspace_id: CURRENT_WORKSPACE_ID,
      service_version_id: serviceVersionId,
      ...parsed.data,
      created_at: now,
      updated_at: now,
    } as unknown as TRow;
    deps.write([...deps.read(), row]);
    return ok(row);
  }

  async function update(id: string, input: TInput): Promise<DataResult<TRow>> {
    const existing = findRow(id);
    if (!existing) return fail("Not found.");
    const version = findServiceVersionRow(existing.service_version_id);
    if (!version || !canEditServiceVersionTemplates(version)) {
      return fail("This version has already been published and can no longer be edited — edit the draft version instead.");
    }
    const parsed = deps.schema.safeParse(input);
    if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

    const updated = { ...existing, ...parsed.data, updated_at: nowIso() } as unknown as TRow;
    deps.write(deps.read().map((r) => (r.id === id ? updated : r)));
    return ok(updated);
  }

  async function remove(id: string): Promise<DataResult<null>> {
    const existing = findRow(id);
    if (!existing) return fail("Not found.");
    const version = findServiceVersionRow(existing.service_version_id);
    if (!version || !canEditServiceVersionTemplates(version)) {
      return fail("This version has already been published and can no longer be edited — edit the draft version instead.");
    }
    deps.write(deps.read().filter((r) => r.id !== id));
    return ok(null);
  }

  return { list, create, update, remove };
}

const includedItemsCrud = createTemplateCrud({ read: readServiceIncludedItems, write: writeServiceIncludedItems, idPrefix: "service_included_item", schema: serviceIncludedItemInputSchema });
const addOnsCrud = createTemplateCrud({ read: readServiceAddOns, write: writeServiceAddOns, idPrefix: "service_addon", schema: serviceAddOnInputSchema });
const checklistTemplateItemsCrud = createTemplateCrud({ read: readServiceChecklistTemplateItems, write: writeServiceChecklistTemplateItems, idPrefix: "service_checklist_template_item", schema: serviceChecklistTemplateItemInputSchema });
const timelineTemplateItemsCrud = createTemplateCrud({ read: readServiceTimelineTemplateItems, write: writeServiceTimelineTemplateItems, idPrefix: "service_timeline_template_item", schema: serviceTimelineTemplateItemInputSchema });
const questionnaireQuestionsCrud = createTemplateCrud({ read: readServiceQuestionnaireQuestions, write: writeServiceQuestionnaireQuestions, idPrefix: "service_questionnaire_question", schema: serviceQuestionnaireQuestionInputSchema });
const budgetTemplateLinesCrud = createTemplateCrud({ read: readServiceBudgetTemplateLines, write: writeServiceBudgetTemplateLines, idPrefix: "service_budget_template_line", schema: serviceBudgetTemplateLineInputSchema });
const approvalTemplateItemsCrud = createTemplateCrud({ read: readServiceApprovalTemplateItems, write: writeServiceApprovalTemplateItems, idPrefix: "service_approval_template_item", schema: serviceApprovalTemplateItemInputSchema });
const travelTemplateItemsCrud = createTemplateCrud({ read: readServiceTravelTemplateItems, write: writeServiceTravelTemplateItems, idPrefix: "service_travel_template_item", schema: serviceTravelTemplateItemInputSchema });
const aiKnowledgeItemsCrud = createTemplateCrud({ read: readServiceAiKnowledgeItems, write: writeServiceAiKnowledgeItems, idPrefix: "service_ai_knowledge_item", schema: serviceAiKnowledgeItemInputSchema });
const requiredDocumentsCrud = createTemplateCrud({ read: readServiceRequiredDocuments, write: writeServiceRequiredDocuments, idPrefix: "service_required_document", schema: serviceRequiredDocumentInputSchema });
const inventoryTemplateItemsCrud = createTemplateCrud({ read: readServiceInventoryTemplateItems, write: writeServiceInventoryTemplateItems, idPrefix: "service_inventory_template_item", schema: serviceInventoryTemplateItemInputSchema });
const purchaseTemplateItemsCrud = createTemplateCrud({ read: readServicePurchaseTemplateItems, write: writeServicePurchaseTemplateItems, idPrefix: "service_purchase_template_item", schema: servicePurchaseTemplateItemInputSchema });
const vendorSuggestionsCrud = createTemplateCrud({ read: readServiceVendorSuggestions, write: writeServiceVendorSuggestions, idPrefix: "service_vendor_suggestion", schema: serviceVendorSuggestionInputSchema });
const teamRoleRequirementsCrud = createTemplateCrud({ read: readServiceTeamRoleRequirements, write: writeServiceTeamRoleRequirements, idPrefix: "service_team_role_requirement", schema: serviceTeamRoleRequirementInputSchema });
const seasonalWindowsCrud = createTemplateCrud({ read: readServiceSeasonalWindows, write: writeServiceSeasonalWindows, idPrefix: "service_seasonal_window", schema: serviceSeasonalWindowInputSchema });
const capabilityRequirementsCrud = createTemplateCrud({ read: readServiceCapabilityRequirements, write: writeServiceCapabilityRequirements, idPrefix: "service_capability_requirement", schema: serviceCapabilityRequirementInputSchema });

/** Deep-copies every "draft" template row for one ServiceVersion into a brand new version id — the mechanical core of publishServiceVersion's "freeze, then start the next draft from a clone" behavior. */
function cloneVersionTemplateRows<TRow extends { id: string; service_version_id: string }>(
  read: () => TRow[],
  write: (rows: TRow[]) => void,
  oldVersionId: string,
  newVersionId: string,
  idPrefix: string,
): void {
  const clones = read()
    .filter((row) => row.service_version_id === oldVersionId)
    .map((row) => ({ ...row, id: generateId(idPrefix), service_version_id: newVersionId }));
  write([...read(), ...clones]);
}

// ---- Service Categories ----

async function listServiceCategories(includeArchived = false): Promise<ServiceCategory[]> {
  await delay(100);
  return readServiceCategories().filter((c) => c.workspace_id === CURRENT_WORKSPACE_ID && (includeArchived || !c.archived_at));
}

async function createServiceCategory(input: ServiceCategoryInput): Promise<DataResult<ServiceCategory>> {
  const parsed = serviceCategoryInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  const now = nowIso();
  const row: ServiceCategory = { id: generateId("service_category"), workspace_id: CURRENT_WORKSPACE_ID, ...parsed.data, created_at: now, updated_at: now, archived_at: null };
  writeServiceCategories([...readServiceCategories(), row]);
  return ok(row);
}

async function updateServiceCategory(id: string, input: ServiceCategoryInput): Promise<DataResult<ServiceCategory>> {
  const existing = findServiceCategoryRow(id);
  if (!existing) return fail("Service category not found.");
  const parsed = serviceCategoryInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  const updated: ServiceCategory = { ...existing, ...parsed.data, updated_at: nowIso() };
  writeServiceCategories(readServiceCategories().map((c) => (c.id === id ? updated : c)));
  return ok(updated);
}

async function archiveServiceCategory(id: string): Promise<DataResult<ServiceCategory>> {
  const existing = findServiceCategoryRow(id);
  if (!existing) return fail("Service category not found.");
  const updated: ServiceCategory = { ...existing, archived_at: nowIso(), updated_at: nowIso() };
  writeServiceCategories(readServiceCategories().map((c) => (c.id === id ? updated : c)));
  return ok(updated);
}

// ---- Services (catalog identity) ----

async function listServices(filters: ServiceFilters = {}): Promise<Service[]> {
  await delay(150);
  const { status, categoryId, includeArchived = false, search } = filters;
  return readServices().filter((service) => {
    if (service.workspace_id !== CURRENT_WORKSPACE_ID) return false;
    if (!includeArchived && service.status === "archived") return false;
    if (status && status !== "all" && service.status !== status) return false;
    if (categoryId && categoryId !== "all" && service.category_id !== categoryId) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (q && !service.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

async function getService(id: string): Promise<Service> {
  await delay(100);
  const service = findServiceRow(id);
  if (!service) throw new NotFoundError(`Service ${id} was not found`);
  return service;
}

async function createService(input: ServiceInput): Promise<DataResult<Service>> {
  const parsed = serviceInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  const now = nowIso();
  const serviceId = generateId("service");
  const draftVersionId = generateId("service_version");

  const service: Service = {
    id: serviceId,
    workspace_id: CURRENT_WORKSPACE_ID,
    ...parsed.data,
    status: "draft",
    draft_version_id: draftVersionId,
    current_published_version_id: null,
    created_at: now,
    updated_at: now,
    archived_at: null,
  };

  const draftVersion: ServiceVersion = {
    id: draftVersionId,
    service_id: serviceId,
    workspace_id: CURRENT_WORKSPACE_ID,
    version_number: null,
    status: "draft",
    name_snapshot: null,
    description_snapshot: null,
    base_price_minor: 0,
    currency: "USD",
    setup_duration_minutes: null,
    breakdown_duration_minutes: null,
    difficulty_score: null,
    experience_level_required: null,
    weather_sensitivity: "none",
    surprise_friendly: false,
    estimated_profit_minor: null,
    change_summary: null,
    published_at: null,
    published_by: null,
    created_at: now,
    updated_at: now,
  };

  writeServices([...readServices(), service]);
  writeServiceVersions([...readServiceVersions(), draftVersion]);

  await getCoreTimelineService().recordActivity(CURRENT_WORKSPACE_ID, "service", service.id, CURRENT_ACTOR, "service_created", `Service created: "${service.name}"`);
  return ok(service);
}

async function updateService(id: string, input: ServiceInput): Promise<DataResult<Service>> {
  const existing = findServiceRow(id);
  if (!existing) return fail("Service not found.");
  if (!canEditServiceCatalogFields(existing)) return fail("An archived Service cannot be edited. Restore it first.");
  const parsed = serviceInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  const updated: Service = { ...existing, ...parsed.data, updated_at: nowIso() };
  writeServices(readServices().map((s) => (s.id === id ? updated : s)));
  await getCoreTimelineService().recordActivity(existing.workspace_id, "service", id, CURRENT_ACTOR, "service_updated", "Service updated");
  return ok(updated);
}

async function transitionService(id: string, to: Service["status"]): Promise<DataResult<Service>> {
  const existing = findServiceRow(id);
  if (!existing) return fail("Service not found.");
  if (!canTransitionServiceStatus(existing.status, to)) return fail("That status change isn't allowed here.");

  const timestamp = nowIso();
  const updated: Service = { ...existing, status: to, archived_at: to === "archived" ? timestamp : null, updated_at: timestamp };
  writeServices(readServices().map((s) => (s.id === id ? updated : s)));
  await getCoreTimelineService().recordActivity(existing.workspace_id, "service", id, CURRENT_ACTOR, "service_status_changed", `Service status changed to "${to}"`, { from: existing.status, to });
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
  await delay(100);
  return readServiceVersions()
    .filter((v) => v.workspace_id === CURRENT_WORKSPACE_ID && v.service_id === serviceId)
    .sort((a, b) => (b.version_number ?? Infinity) - (a.version_number ?? Infinity));
}

async function getServiceVersion(id: string): Promise<ServiceVersion> {
  await delay(100);
  const version = findServiceVersionRow(id);
  if (!version) throw new NotFoundError(`Service version ${id} was not found`);
  return version;
}

async function updateServiceVersionDraft(serviceId: string, input: ServiceVersionInput): Promise<DataResult<ServiceVersion>> {
  const service = findServiceRow(serviceId);
  if (!service || !service.draft_version_id) return fail("Service not found.");
  const draft = findServiceVersionRow(service.draft_version_id);
  if (!draft) return fail("Draft version not found.");
  if (!canEditServiceVersionTemplates(draft)) return fail("This version is no longer editable.");

  const parsed = serviceVersionInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  const updated: ServiceVersion = { ...draft, ...parsed.data, updated_at: nowIso() };
  writeServiceVersions(readServiceVersions().map((v) => (v.id === draft.id ? updated : v)));
  return ok(updated);
}

/** Runs cloneVersionTemplateRows once per template table — a plain function (not a heterogeneous array of the differently-typed read/write pairs) so each call keeps its own concrete row type instead of everything collapsing to `never` under a shared array element type. */
function cloneAllTemplateRowsForNewVersion(oldVersionId: string, newVersionId: string): void {
  cloneVersionTemplateRows(readServiceIncludedItems, writeServiceIncludedItems, oldVersionId, newVersionId, "service_included_item");
  cloneVersionTemplateRows(readServiceAddOns, writeServiceAddOns, oldVersionId, newVersionId, "service_addon");
  cloneVersionTemplateRows(readServiceChecklistTemplateItems, writeServiceChecklistTemplateItems, oldVersionId, newVersionId, "service_checklist_template_item");
  cloneVersionTemplateRows(readServiceTimelineTemplateItems, writeServiceTimelineTemplateItems, oldVersionId, newVersionId, "service_timeline_template_item");
  cloneVersionTemplateRows(readServiceQuestionnaireQuestions, writeServiceQuestionnaireQuestions, oldVersionId, newVersionId, "service_questionnaire_question");
  cloneVersionTemplateRows(readServiceBudgetTemplateLines, writeServiceBudgetTemplateLines, oldVersionId, newVersionId, "service_budget_template_line");
  cloneVersionTemplateRows(readServiceApprovalTemplateItems, writeServiceApprovalTemplateItems, oldVersionId, newVersionId, "service_approval_template_item");
  cloneVersionTemplateRows(readServiceTravelTemplateItems, writeServiceTravelTemplateItems, oldVersionId, newVersionId, "service_travel_template_item");
  cloneVersionTemplateRows(readServiceAiKnowledgeItems, writeServiceAiKnowledgeItems, oldVersionId, newVersionId, "service_ai_knowledge_item");
  cloneVersionTemplateRows(readServiceRequiredDocuments, writeServiceRequiredDocuments, oldVersionId, newVersionId, "service_required_document");
  cloneVersionTemplateRows(readServiceInventoryTemplateItems, writeServiceInventoryTemplateItems, oldVersionId, newVersionId, "service_inventory_template_item");
  cloneVersionTemplateRows(readServicePurchaseTemplateItems, writeServicePurchaseTemplateItems, oldVersionId, newVersionId, "service_purchase_template_item");
  cloneVersionTemplateRows(readServiceVendorSuggestions, writeServiceVendorSuggestions, oldVersionId, newVersionId, "service_vendor_suggestion");
  cloneVersionTemplateRows(readServiceTeamRoleRequirements, writeServiceTeamRoleRequirements, oldVersionId, newVersionId, "service_team_role_requirement");
  cloneVersionTemplateRows(readServiceSeasonalWindows, writeServiceSeasonalWindows, oldVersionId, newVersionId, "service_seasonal_window");
  cloneVersionTemplateRows(readServiceCapabilityRequirements, writeServiceCapabilityRequirements, oldVersionId, newVersionId, "service_capability_requirement");
}

async function publishServiceVersion(serviceId: string, input: PublishServiceVersionInput): Promise<DataResult<ServiceVersion>> {
  const service = findServiceRow(serviceId);
  if (!service || !service.draft_version_id) return fail("Service not found.");
  const draft = findServiceVersionRow(service.draft_version_id);
  if (!draft) return fail("Draft version not found.");

  const publishError = canPublishServiceVersion(draft);
  if (publishError) return fail(publishError);
  const parsed = publishServiceVersionInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  const existingNumbers = readServiceVersions()
    .filter((v) => v.service_id === serviceId)
    .map((v) => v.version_number);
  const versionNumber = computeNextServiceVersionNumber(existingNumbers);
  const timestamp = nowIso();

  const published: ServiceVersion = {
    ...draft,
    status: "published",
    version_number: versionNumber,
    // Written exactly once, here — the only place name_snapshot/
    // description_snapshot are ever set. Copied from Service's own
    // always-current name/description at this exact moment; never edited
    // independently afterward (serviceVersionInputSchema has no such
    // fields), so a published version's display text is permanently fixed
    // even if the Service is later renamed.
    name_snapshot: service.name,
    description_snapshot: service.description,
    change_summary: parsed.data.change_summary,
    published_at: timestamp,
    published_by: CURRENT_ACTOR,
    updated_at: timestamp,
  };

  const newDraftId = generateId("service_version");
  const newDraft: ServiceVersion = {
    ...published,
    id: newDraftId,
    status: "draft",
    version_number: null,
    // A draft has no historical identity yet — anything displaying it
    // reads Service.name/description directly. These are only ever
    // (re)populated the next time THIS draft itself gets published.
    name_snapshot: null,
    description_snapshot: null,
    change_summary: null,
    published_at: null,
    published_by: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeServiceVersions([...readServiceVersions().map((v) => (v.id === draft.id ? published : v)), newDraft]);

  cloneAllTemplateRowsForNewVersion(draft.id, newDraftId);

  const updatedService: Service = { ...service, draft_version_id: newDraftId, current_published_version_id: draft.id, updated_at: timestamp };
  writeServices(readServices().map((s) => (s.id === serviceId ? updatedService : s)));

  await getCoreTimelineService().recordActivity(
    service.workspace_id,
    "service",
    service.id,
    CURRENT_ACTOR,
    "service_version_published",
    `Version ${versionNumber} published for "${service.name}"`,
    { version_number: versionNumber },
  );

  return ok(published);
}

// ---- EventService (Instance layer) ----

async function listEventServicesByEvent(eventId: string): Promise<EventService[]> {
  await delay(100);
  return readEventServices().filter((e) => e.workspace_id === CURRENT_WORKSPACE_ID && e.event_id === eventId);
}

async function listEventServicesByService(serviceId: string): Promise<EventService[]> {
  await delay(100);
  return readEventServices().filter((e) => e.workspace_id === CURRENT_WORKSPACE_ID && e.service_id === serviceId);
}

/** One pass over the store, not one filter call per id — see this method's own doc comment on repository.ts for the full contract (workspace-scoped, cancelled excluded, missing ids simply absent). */
async function getServiceUsageCounts(serviceIds: string[]): Promise<Record<string, number>> {
  await delay(100);
  const idSet = new Set(serviceIds);
  const counts: Record<string, number> = {};
  for (const eventService of readEventServices()) {
    if (eventService.workspace_id !== CURRENT_WORKSPACE_ID) continue;
    if (!idSet.has(eventService.service_id)) continue;
    if (!countsTowardServiceUsage(eventService.status)) continue;
    counts[eventService.service_id] = (counts[eventService.service_id] ?? 0) + 1;
  }
  return counts;
}

async function getEventService(id: string): Promise<EventService> {
  await delay(100);
  const eventService = findEventServiceRow(id);
  if (!eventService) throw new NotFoundError(`EventService ${id} was not found`);
  return eventService;
}

async function assignServiceToEvent(eventId: string, input: AssignServiceToEventInput): Promise<DataResult<EventService>> {
  const parsed = assignServiceToEventInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  const event = readEvents().find((e) => e.id === eventId && e.workspace_id === CURRENT_WORKSPACE_ID);
  if (!event) return fail("Event not found.");

  const service = findServiceRow(parsed.data.service_id);
  if (!service) return fail("Service not found.");
  if (!canAssignService(service)) return fail("This Service has no published version and cannot be assigned yet.");

  const versionId = service.current_published_version_id as string;
  const version = findServiceVersionRow(versionId);
  if (!version) return fail("Published version not found.");

  const plan = buildEventServiceAssignmentPlan(
    {
      service,
      version,
      addOns: readServiceAddOns().filter((a) => a.service_version_id === versionId),
      checklistTemplateItems: readServiceChecklistTemplateItems().filter((t) => t.service_version_id === versionId),
      timelineTemplateItems: readServiceTimelineTemplateItems().filter((t) => t.service_version_id === versionId),
      inventoryTemplateItems: readServiceInventoryTemplateItems().filter((t) => t.service_version_id === versionId),
      purchaseTemplateItems: readServicePurchaseTemplateItems().filter((t) => t.service_version_id === versionId),
      budgetTemplateLines: readServiceBudgetTemplateLines().filter((t) => t.service_version_id === versionId),
      teamRoleRequirements: readServiceTeamRoleRequirements().filter((t) => t.service_version_id === versionId),
      vendorSuggestions: readServiceVendorSuggestions().filter((t) => t.service_version_id === versionId),
    },
    {
      eventDate: event.event_date,
      eventStartTime: event.start_time,
      selectedAddOnIds: parsed.data.selected_add_on_ids,
    },
  );

  const timestamp = nowIso();
  const eventService: EventService = {
    id: generateId("event_service"),
    workspace_id: CURRENT_WORKSPACE_ID,
    event_id: eventId,
    service_id: service.id,
    service_version_id: versionId,
    name: plan.name,
    name_template_value: plan.name_template_value,
    price_minor: plan.price_minor,
    price_template_value: plan.price_template_value,
    currency: plan.currency,
    selected_add_on_ids: plan.selected_add_on_ids,
    status: "proposed",
    assigned_at: timestamp,
    assigned_by: CURRENT_ACTOR,
    created_at: timestamp,
    updated_at: timestamp,
  };
  writeEventServices([...readEventServices(), eventService]);

  const existingChecklistCount = readChecklistItems().filter((c) => c.owner_type === "event" && c.owner_id === eventId).length;
  const newChecklistItems: ChecklistItem[] = plan.checklistItems.map((item, index) => ({
    id: generateId("checklist"),
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: eventId,
    title: item.title,
    description: null,
    category: item.category,
    priority: item.priority,
    status: "pending",
    due_date: item.due_date,
    completed_at: null,
    assigned_type: "unknown",
    assigned_id: null,
    assigned_name: null,
    sort_order: existingChecklistCount + index,
    source_event_service_id: eventService.id,
    template_snapshot: item.template_snapshot,
    created_at: timestamp,
    updated_at: timestamp,
  }));
  writeChecklistItems([...readChecklistItems(), ...newChecklistItems]);

  const existingScheduleCount = readScheduleItems().filter((s) => s.owner_type === "event" && s.owner_id === eventId).length;
  const newScheduleItems: EventScheduleItem[] = plan.scheduleItems.map((item, index) => ({
    id: generateId("schedule"),
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: eventId,
    title: item.title,
    description: null,
    start_time: item.start_time,
    end_time: item.end_time,
    location: null,
    assigned_to: null,
    category: item.category,
    status: "planned",
    sort_order: existingScheduleCount + index,
    source_event_service_id: eventService.id,
    template_snapshot: item.template_snapshot,
    created_at: timestamp,
    updated_at: timestamp,
  }));
  writeScheduleItems([...readScheduleItems(), ...newScheduleItems]);

  const inventoryRequirements: EventServiceInventoryRequirement[] = plan.inventoryRequirements.map((r) => ({
    id: generateId("event_service_inventory_requirement"),
    workspace_id: CURRENT_WORKSPACE_ID,
    event_service_id: eventService.id,
    inventory_item_id: r.inventory_item_id,
    item_name: r.item_name,
    quantity: r.quantity,
    is_fulfilled: false,
    note: null,
    created_at: timestamp,
    updated_at: timestamp,
  }));
  writeEventServiceInventoryRequirements([...readEventServiceInventoryRequirements(), ...inventoryRequirements]);

  const purchaseRequirements: EventServicePurchaseRequirement[] = plan.purchaseRequirements.map((r) => ({
    id: generateId("event_service_purchase_requirement"),
    workspace_id: CURRENT_WORKSPACE_ID,
    event_service_id: eventService.id,
    item_name: r.item_name,
    estimated_unit_cost_minor: r.estimated_unit_cost_minor,
    estimated_quantity: r.estimated_quantity,
    typical_vendor_id: r.typical_vendor_id,
    fulfilled_purchase_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  }));
  writeEventServicePurchaseRequirements([...readEventServicePurchaseRequirements(), ...purchaseRequirements]);

  const budgetLines: EventServiceBudgetLine[] = plan.budgetLines.map((line) => ({
    id: generateId("event_service_budget_line"),
    workspace_id: CURRENT_WORKSPACE_ID,
    event_service_id: eventService.id,
    label: line.label,
    category: line.category,
    estimated_revenue_minor: line.estimated_revenue_minor,
    estimated_cost_minor: line.estimated_cost_minor,
    created_at: timestamp,
    updated_at: timestamp,
  }));
  writeEventServiceBudgetLines([...readEventServiceBudgetLines(), ...budgetLines]);

  const teamRequirements: EventServiceTeamRequirement[] = plan.teamRequirements.map((r) => ({
    id: generateId("event_service_team_requirement"),
    workspace_id: CURRENT_WORKSPACE_ID,
    event_service_id: eventService.id,
    role_label: r.role_label,
    quantity: r.quantity,
    note: r.note,
    assigned_member_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  }));
  writeEventServiceTeamRequirements([...readEventServiceTeamRequirements(), ...teamRequirements]);

  const vendorAssignments: EventServiceVendorAssignment[] = plan.vendorAssignments.map((v) => ({
    id: generateId("event_service_vendor_assignment"),
    workspace_id: CURRENT_WORKSPACE_ID,
    event_service_id: eventService.id,
    vendor_id: v.vendor_id,
    status: "suggested",
    note: v.note,
    created_at: timestamp,
    updated_at: timestamp,
  }));
  writeEventServiceVendorAssignments([...readEventServiceVendorAssignments(), ...vendorAssignments]);

  await getCoreTimelineService().recordActivity(
    CURRENT_WORKSPACE_ID,
    "event",
    eventId,
    CURRENT_ACTOR,
    "event_service_assigned",
    `Service "${eventService.name}" assigned to this Event`,
    { event_service_id: eventService.id, service_id: service.id },
  );

  return ok(eventService);
}

async function removeEventService(id: string): Promise<DataResult<null>> {
  const existing = findEventServiceRow(id);
  if (!existing) return fail("Not found.");

  writeChecklistItems(readChecklistItems().filter((c) => !(c.source_event_service_id === id && isGeneratedChecklistItemRemovable(c.status))));
  writeScheduleItems(readScheduleItems().filter((s) => !(s.source_event_service_id === id && isGeneratedScheduleItemRemovable(s.status))));
  writeEventServiceInventoryRequirements(readEventServiceInventoryRequirements().filter((r) => r.event_service_id !== id));
  writeEventServicePurchaseRequirements(readEventServicePurchaseRequirements().filter((r) => r.event_service_id !== id));
  writeEventServiceBudgetLines(readEventServiceBudgetLines().filter((r) => r.event_service_id !== id));
  writeEventServiceTeamRequirements(readEventServiceTeamRequirements().filter((r) => r.event_service_id !== id));
  writeEventServiceVendorAssignments(readEventServiceVendorAssignments().filter((r) => r.event_service_id !== id));
  writeEventServiceQuestionnaireResponses(readEventServiceQuestionnaireResponses().filter((r) => r.event_service_id !== id));
  writeEventServices(readEventServices().filter((e) => e.id !== id));

  await getCoreTimelineService().recordActivity(existing.workspace_id, "event", existing.event_id, CURRENT_ACTOR, "event_service_removed", `Service "${existing.name}" removed from this Event`);
  return ok(null);
}

async function transitionEventServiceStatus(id: string, to: EventService["status"]): Promise<DataResult<EventService>> {
  const existing = findEventServiceRow(id);
  if (!existing) return fail("Not found.");
  if (!canTransitionEventServiceStatus(existing.status, to)) return fail("That status change isn't allowed here.");

  const updated: EventService = { ...existing, status: to, updated_at: nowIso() };
  writeEventServices(readEventServices().map((e) => (e.id === id ? updated : e)));
  await getCoreTimelineService().recordActivity(existing.workspace_id, "event_service", id, CURRENT_ACTOR, "event_service_status_changed", `Status changed to "${to}"`, { from: existing.status, to });
  return ok(updated);
}

/**
 * Only ever touches `name`/`price_minor` — `name_template_value`/
 * `price_template_value`/`service_version_id` are carried through from
 * `existing` untouched by construction, never reassigned here.
 */
async function updateEventServiceOverrides(id: string, input: UpdateEventServiceOverridesInput): Promise<DataResult<EventService>> {
  const existing = findEventServiceRow(id);
  if (!existing) return fail("Not found.");
  if (!canOverrideEventService(existing.status)) {
    return fail("This Service's overrides can no longer be edited once it is completed or cancelled.");
  }
  const parsed = updateEventServiceOverridesInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));

  const updated: EventService = {
    ...existing,
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.price_minor !== undefined ? { price_minor: parsed.data.price_minor } : {}),
    updated_at: nowIso(),
  };
  writeEventServices(readEventServices().map((e) => (e.id === id ? updated : e)));
  return ok(updated);
}

async function listEventServiceInventoryRequirementsFn(eventServiceId: string): Promise<EventServiceInventoryRequirement[]> {
  await delay(100);
  return readEventServiceInventoryRequirements().filter((r) => r.workspace_id === CURRENT_WORKSPACE_ID && r.event_service_id === eventServiceId);
}

async function fulfillEventServiceInventoryRequirement(id: string): Promise<DataResult<EventServiceInventoryRequirement>> {
  const existing = readEventServiceInventoryRequirements().find((r) => r.id === id && r.workspace_id === CURRENT_WORKSPACE_ID);
  if (!existing) return fail("Not found.");
  const updated: EventServiceInventoryRequirement = { ...existing, is_fulfilled: true, updated_at: nowIso() };
  writeEventServiceInventoryRequirements(readEventServiceInventoryRequirements().map((r) => (r.id === id ? updated : r)));
  return ok(updated);
}

async function listEventServicePurchaseRequirementsFn(eventServiceId: string): Promise<EventServicePurchaseRequirement[]> {
  await delay(100);
  return readEventServicePurchaseRequirements().filter((r) => r.workspace_id === CURRENT_WORKSPACE_ID && r.event_service_id === eventServiceId);
}

async function linkEventServicePurchaseRequirementToPurchase(id: string, purchaseId: string): Promise<DataResult<EventServicePurchaseRequirement>> {
  const existing = readEventServicePurchaseRequirements().find((r) => r.id === id && r.workspace_id === CURRENT_WORKSPACE_ID);
  if (!existing) return fail("Not found.");
  const updated: EventServicePurchaseRequirement = { ...existing, fulfilled_purchase_id: purchaseId, updated_at: nowIso() };
  writeEventServicePurchaseRequirements(readEventServicePurchaseRequirements().map((r) => (r.id === id ? updated : r)));
  return ok(updated);
}

async function listEventServiceBudgetLinesFn(eventServiceId: string): Promise<EventServiceBudgetLine[]> {
  await delay(100);
  return readEventServiceBudgetLines().filter((r) => r.workspace_id === CURRENT_WORKSPACE_ID && r.event_service_id === eventServiceId);
}

async function listEventServiceTeamRequirementsFn(eventServiceId: string): Promise<EventServiceTeamRequirement[]> {
  await delay(100);
  return readEventServiceTeamRequirements().filter((r) => r.workspace_id === CURRENT_WORKSPACE_ID && r.event_service_id === eventServiceId);
}

async function listEventServiceVendorAssignmentsFn(eventServiceId: string): Promise<EventServiceVendorAssignment[]> {
  await delay(100);
  return readEventServiceVendorAssignments().filter((r) => r.workspace_id === CURRENT_WORKSPACE_ID && r.event_service_id === eventServiceId);
}

async function setVendorAssignmentStatus(id: string, status: EventServiceVendorAssignment["status"]): Promise<DataResult<EventServiceVendorAssignment>> {
  const existing = readEventServiceVendorAssignments().find((r) => r.id === id && r.workspace_id === CURRENT_WORKSPACE_ID);
  if (!existing) return fail("Not found.");
  const updated: EventServiceVendorAssignment = { ...existing, status, updated_at: nowIso() };
  writeEventServiceVendorAssignments(readEventServiceVendorAssignments().map((r) => (r.id === id ? updated : r)));
  return ok(updated);
}
async function confirmEventServiceVendorAssignment(id: string): Promise<DataResult<EventServiceVendorAssignment>> {
  return setVendorAssignmentStatus(id, "confirmed");
}
async function declineEventServiceVendorAssignment(id: string): Promise<DataResult<EventServiceVendorAssignment>> {
  return setVendorAssignmentStatus(id, "declined");
}

async function listEventServiceQuestionnaireResponsesFn(eventServiceId: string): Promise<EventServiceQuestionnaireResponse[]> {
  await delay(100);
  return readEventServiceQuestionnaireResponses().filter((r) => r.workspace_id === CURRENT_WORKSPACE_ID && r.event_service_id === eventServiceId);
}

async function submitEventServiceQuestionnaireResponse(eventServiceId: string, input: EventServiceQuestionnaireResponseInput): Promise<DataResult<EventServiceQuestionnaireResponse>> {
  const parsed = eventServiceQuestionnaireResponseInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  const now = nowIso();
  const existing = readEventServiceQuestionnaireResponses().find((r) => r.event_service_id === eventServiceId && r.question_id === parsed.data.question_id);
  if (existing) {
    const updated: EventServiceQuestionnaireResponse = { ...existing, ...parsed.data, updated_at: now };
    writeEventServiceQuestionnaireResponses(readEventServiceQuestionnaireResponses().map((r) => (r.id === existing.id ? updated : r)));
    return ok(updated);
  }
  const row: EventServiceQuestionnaireResponse = { id: generateId("event_service_questionnaire_response"), workspace_id: CURRENT_WORKSPACE_ID, event_service_id: eventServiceId, ...parsed.data, created_at: now, updated_at: now };
  writeEventServiceQuestionnaireResponses([...readEventServiceQuestionnaireResponses(), row]);
  return ok(row);
}

// ---- Notes/Timeline delegation ----

async function getTimelineByServiceId(serviceId: string): Promise<TimelineActivity[]> {
  const service = findServiceRow(serviceId);
  if (!service) return [];
  return getCoreTimelineService().getTimelineForOwner(service.workspace_id, "service", serviceId);
}
async function getNotesByServiceId(serviceId: string): Promise<Note[]> {
  const service = findServiceRow(serviceId);
  if (!service) return [];
  return getCoreNotesService().getNotesForOwner(service.workspace_id, "service", serviceId);
}
async function createServiceNote(serviceId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const service = findServiceRow(serviceId);
  if (!service) return fail("Service not found.");
  return getCoreNotesService().createNoteForOwner(service.workspace_id, "service", serviceId, CURRENT_ACTOR, input);
}
async function updateServiceNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note> | null> {
  return getCoreNotesService().updateNoteById(CURRENT_WORKSPACE_ID, noteId, CURRENT_ACTOR, input);
}
async function toggleServiceNotePin(noteId: string): Promise<DataResult<Note> | null> {
  return getCoreNotesService().togglePinNoteById(CURRENT_WORKSPACE_ID, noteId, CURRENT_ACTOR);
}

async function getTimelineByEventServiceId(eventServiceId: string): Promise<TimelineActivity[]> {
  const eventService = findEventServiceRow(eventServiceId);
  if (!eventService) return [];
  return getCoreTimelineService().getTimelineForOwner(eventService.workspace_id, "event_service", eventServiceId);
}
async function getNotesByEventServiceId(eventServiceId: string): Promise<Note[]> {
  const eventService = findEventServiceRow(eventServiceId);
  if (!eventService) return [];
  return getCoreNotesService().getNotesForOwner(eventService.workspace_id, "event_service", eventServiceId);
}
async function createEventServiceNote(eventServiceId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const eventService = findEventServiceRow(eventServiceId);
  if (!eventService) return fail("EventService not found.");
  return getCoreNotesService().createNoteForOwner(eventService.workspace_id, "event_service", eventServiceId, CURRENT_ACTOR, input);
}
async function updateEventServiceNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note> | null> {
  return getCoreNotesService().updateNoteById(CURRENT_WORKSPACE_ID, noteId, CURRENT_ACTOR, input);
}
async function toggleEventServiceNotePin(noteId: string): Promise<DataResult<Note> | null> {
  return getCoreNotesService().togglePinNoteById(CURRENT_WORKSPACE_ID, noteId, CURRENT_ACTOR);
}

export const mockServicesRepository: ServicesRepository = {
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

  listEventServiceInventoryRequirements: listEventServiceInventoryRequirementsFn,
  fulfillEventServiceInventoryRequirement,

  listEventServicePurchaseRequirements: listEventServicePurchaseRequirementsFn,
  linkEventServicePurchaseRequirementToPurchase,

  listEventServiceBudgetLines: listEventServiceBudgetLinesFn,
  listEventServiceTeamRequirements: listEventServiceTeamRequirementsFn,

  listEventServiceVendorAssignments: listEventServiceVendorAssignmentsFn,
  confirmEventServiceVendorAssignment,
  declineEventServiceVendorAssignment,

  listEventServiceQuestionnaireResponses: listEventServiceQuestionnaireResponsesFn,
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
