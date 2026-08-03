import type { ServiceCategory } from "@/types/serviceCategory";
import type { Service } from "@/types/service";
import type { ServiceVersion } from "@/types/serviceVersion";
import type { ServiceIncludedItem } from "@/types/serviceIncludedItem";
import type { ServiceAddOn } from "@/types/serviceAddOn";
import type { ServiceChecklistTemplateItem } from "@/types/serviceChecklistTemplateItem";
import type { ServiceTimelineTemplateItem } from "@/types/serviceTimelineTemplateItem";
import type { ServiceQuestionnaireQuestion } from "@/types/serviceQuestionnaireQuestion";
import type { ServiceBudgetTemplateLine } from "@/types/serviceBudgetTemplateLine";
import type { ServiceApprovalTemplateItem } from "@/types/serviceApprovalTemplateItem";
import type { ServiceTravelTemplateItem } from "@/types/serviceTravelTemplateItem";
import type { ServiceAiKnowledgeItem } from "@/types/serviceAiKnowledgeItem";
import type { ServiceRequiredDocument } from "@/types/serviceRequiredDocument";
import type { ServiceInventoryTemplateItem } from "@/types/serviceInventoryTemplateItem";
import type { ServicePurchaseTemplateItem } from "@/types/servicePurchaseTemplateItem";
import type { ServiceVendorSuggestion } from "@/types/serviceVendorSuggestion";
import type { ServiceTeamRoleRequirement } from "@/types/serviceTeamRoleRequirement";
import type { ServiceSeasonalWindow } from "@/types/serviceSeasonalWindow";
import type { ServiceCapabilityRequirement } from "@/types/serviceCapabilityRequirement";
import type { EventService } from "@/types/eventService";
import type { EventServiceInventoryRequirement } from "@/types/eventServiceInventoryRequirement";
import type { EventServicePurchaseRequirement } from "@/types/eventServicePurchaseRequirement";
import type { EventServiceBudgetLine } from "@/types/eventServiceBudgetLine";
import type { EventServiceTeamRequirement } from "@/types/eventServiceTeamRequirement";
import type { EventServiceVendorAssignment } from "@/types/eventServiceVendorAssignment";
import type { EventServiceQuestionnaireResponse } from "@/types/eventServiceQuestionnaireResponse";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Note } from "@/types/note";
import type { NoteFormInput } from "@/modules/notes/schema";
import type { ServiceStatus } from "@/core/enums/serviceStatus";
import type { EventServiceStatus } from "@/core/enums/eventServiceStatus";
import type { DataResult } from "@/lib/data/result";
import type {
  ServiceCategoryInput,
  ServiceInput,
  ServiceVersionInput,
  PublishServiceVersionInput,
  ServiceIncludedItemInput,
  ServiceAddOnInput,
  ServiceChecklistTemplateItemInput,
  ServiceTimelineTemplateItemInput,
  ServiceQuestionnaireQuestionInput,
  ServiceBudgetTemplateLineInput,
  ServiceApprovalTemplateItemInput,
  ServiceTravelTemplateItemInput,
  ServiceAiKnowledgeItemInput,
  ServiceRequiredDocumentInput,
  ServiceInventoryTemplateItemInput,
  ServicePurchaseTemplateItemInput,
  ServiceVendorSuggestionInput,
  ServiceTeamRoleRequirementInput,
  ServiceSeasonalWindowInput,
  ServiceCapabilityRequirementInput,
  AssignServiceToEventInput,
  EventServiceQuestionnaireResponseInput,
  UpdateEventServiceOverridesInput,
} from "@/modules/services/schema";

export interface ServiceFilters {
  status?: ServiceStatus | "all";
  categoryId?: string | "all";
  includeArchived?: boolean;
  search?: string;
}

/**
 * The single Services persistence contract — Foundation phase (Phase 2a).
 * Implemented once by the mock repository (`mockRepository.ts`, fully real)
 * and once by the Supabase repository (`supabaseRepository.ts`, a throwing
 * placeholder for now — same "Foundation phase ships mock-only" precedent
 * Inventory's own Foundation phase established). `lib/data/index.ts` picks
 * between them via `selectRepository()`.
 *
 * Every template-table method pair (list/create/update/remove) only
 * succeeds while its parent ServiceVersion is `status: "draft"` — see
 * `canEditServiceVersionTemplates` in `core/workflows/serviceWorkflow.ts`.
 * `assignServiceToEvent` is the one operation that reads across almost
 * every table in this file at once — see
 * `buildEventServiceAssignmentPlan` in `core/workflows/eventServiceWorkflow.ts`
 * for the pure logic it's built from.
 *
 * Nothing here ever creates a real Purchase, Invoice, Expense, or Inventory
 * movement — every `EventService*Requirement` row is a draft/estimate a
 * human reviews before turning it into something real, per the
 * architecture's "Services never auto-mutates a real ledger" rule.
 *
 * Blueprint (Phase 2b), Dependencies/Conflicts/Resource Packages/Service
 * Health (Phase 2c) are NOT part of this contract yet.
 */
export interface ServicesRepository {
  listServiceCategories(includeArchived?: boolean): Promise<ServiceCategory[]>;
  createServiceCategory(input: ServiceCategoryInput): Promise<DataResult<ServiceCategory>>;
  updateServiceCategory(id: string, input: ServiceCategoryInput): Promise<DataResult<ServiceCategory>>;
  archiveServiceCategory(id: string): Promise<DataResult<ServiceCategory>>;

  listServices(filters?: ServiceFilters): Promise<Service[]>;
  getService(id: string): Promise<Service>;
  createService(input: ServiceInput): Promise<DataResult<Service>>;
  updateService(id: string, input: ServiceInput): Promise<DataResult<Service>>;
  activateService(id: string): Promise<DataResult<Service>>;
  deactivateService(id: string): Promise<DataResult<Service>>;
  archiveService(id: string): Promise<DataResult<Service>>;
  restoreService(id: string): Promise<DataResult<Service>>;

  listServiceVersions(serviceId: string): Promise<ServiceVersion[]>;
  getServiceVersion(id: string): Promise<ServiceVersion>;
  updateServiceVersionDraft(serviceId: string, input: ServiceVersionInput): Promise<DataResult<ServiceVersion>>;
  publishServiceVersion(serviceId: string, input: PublishServiceVersionInput): Promise<DataResult<ServiceVersion>>;

  listServiceIncludedItems(serviceVersionId: string): Promise<ServiceIncludedItem[]>;
  createServiceIncludedItem(serviceVersionId: string, input: ServiceIncludedItemInput): Promise<DataResult<ServiceIncludedItem>>;
  updateServiceIncludedItem(id: string, input: ServiceIncludedItemInput): Promise<DataResult<ServiceIncludedItem>>;
  removeServiceIncludedItem(id: string): Promise<DataResult<null>>;

  listServiceAddOns(serviceVersionId: string): Promise<ServiceAddOn[]>;
  createServiceAddOn(serviceVersionId: string, input: ServiceAddOnInput): Promise<DataResult<ServiceAddOn>>;
  updateServiceAddOn(id: string, input: ServiceAddOnInput): Promise<DataResult<ServiceAddOn>>;
  removeServiceAddOn(id: string): Promise<DataResult<null>>;

  listServiceChecklistTemplateItems(serviceVersionId: string): Promise<ServiceChecklistTemplateItem[]>;
  createServiceChecklistTemplateItem(serviceVersionId: string, input: ServiceChecklistTemplateItemInput): Promise<DataResult<ServiceChecklistTemplateItem>>;
  updateServiceChecklistTemplateItem(id: string, input: ServiceChecklistTemplateItemInput): Promise<DataResult<ServiceChecklistTemplateItem>>;
  removeServiceChecklistTemplateItem(id: string): Promise<DataResult<null>>;

  listServiceTimelineTemplateItems(serviceVersionId: string): Promise<ServiceTimelineTemplateItem[]>;
  createServiceTimelineTemplateItem(serviceVersionId: string, input: ServiceTimelineTemplateItemInput): Promise<DataResult<ServiceTimelineTemplateItem>>;
  updateServiceTimelineTemplateItem(id: string, input: ServiceTimelineTemplateItemInput): Promise<DataResult<ServiceTimelineTemplateItem>>;
  removeServiceTimelineTemplateItem(id: string): Promise<DataResult<null>>;

  listServiceQuestionnaireQuestions(serviceVersionId: string): Promise<ServiceQuestionnaireQuestion[]>;
  createServiceQuestionnaireQuestion(serviceVersionId: string, input: ServiceQuestionnaireQuestionInput): Promise<DataResult<ServiceQuestionnaireQuestion>>;
  updateServiceQuestionnaireQuestion(id: string, input: ServiceQuestionnaireQuestionInput): Promise<DataResult<ServiceQuestionnaireQuestion>>;
  removeServiceQuestionnaireQuestion(id: string): Promise<DataResult<null>>;

  listServiceBudgetTemplateLines(serviceVersionId: string): Promise<ServiceBudgetTemplateLine[]>;
  createServiceBudgetTemplateLine(serviceVersionId: string, input: ServiceBudgetTemplateLineInput): Promise<DataResult<ServiceBudgetTemplateLine>>;
  updateServiceBudgetTemplateLine(id: string, input: ServiceBudgetTemplateLineInput): Promise<DataResult<ServiceBudgetTemplateLine>>;
  removeServiceBudgetTemplateLine(id: string): Promise<DataResult<null>>;

  listServiceApprovalTemplateItems(serviceVersionId: string): Promise<ServiceApprovalTemplateItem[]>;
  createServiceApprovalTemplateItem(serviceVersionId: string, input: ServiceApprovalTemplateItemInput): Promise<DataResult<ServiceApprovalTemplateItem>>;
  updateServiceApprovalTemplateItem(id: string, input: ServiceApprovalTemplateItemInput): Promise<DataResult<ServiceApprovalTemplateItem>>;
  removeServiceApprovalTemplateItem(id: string): Promise<DataResult<null>>;

  listServiceTravelTemplateItems(serviceVersionId: string): Promise<ServiceTravelTemplateItem[]>;
  createServiceTravelTemplateItem(serviceVersionId: string, input: ServiceTravelTemplateItemInput): Promise<DataResult<ServiceTravelTemplateItem>>;
  updateServiceTravelTemplateItem(id: string, input: ServiceTravelTemplateItemInput): Promise<DataResult<ServiceTravelTemplateItem>>;
  removeServiceTravelTemplateItem(id: string): Promise<DataResult<null>>;

  listServiceAiKnowledgeItems(serviceVersionId: string): Promise<ServiceAiKnowledgeItem[]>;
  createServiceAiKnowledgeItem(serviceVersionId: string, input: ServiceAiKnowledgeItemInput): Promise<DataResult<ServiceAiKnowledgeItem>>;
  updateServiceAiKnowledgeItem(id: string, input: ServiceAiKnowledgeItemInput): Promise<DataResult<ServiceAiKnowledgeItem>>;
  removeServiceAiKnowledgeItem(id: string): Promise<DataResult<null>>;

  listServiceRequiredDocuments(serviceVersionId: string): Promise<ServiceRequiredDocument[]>;
  createServiceRequiredDocument(serviceVersionId: string, input: ServiceRequiredDocumentInput): Promise<DataResult<ServiceRequiredDocument>>;
  updateServiceRequiredDocument(id: string, input: ServiceRequiredDocumentInput): Promise<DataResult<ServiceRequiredDocument>>;
  removeServiceRequiredDocument(id: string): Promise<DataResult<null>>;

  listServiceInventoryTemplateItems(serviceVersionId: string): Promise<ServiceInventoryTemplateItem[]>;
  createServiceInventoryTemplateItem(serviceVersionId: string, input: ServiceInventoryTemplateItemInput): Promise<DataResult<ServiceInventoryTemplateItem>>;
  updateServiceInventoryTemplateItem(id: string, input: ServiceInventoryTemplateItemInput): Promise<DataResult<ServiceInventoryTemplateItem>>;
  removeServiceInventoryTemplateItem(id: string): Promise<DataResult<null>>;

  listServicePurchaseTemplateItems(serviceVersionId: string): Promise<ServicePurchaseTemplateItem[]>;
  createServicePurchaseTemplateItem(serviceVersionId: string, input: ServicePurchaseTemplateItemInput): Promise<DataResult<ServicePurchaseTemplateItem>>;
  updateServicePurchaseTemplateItem(id: string, input: ServicePurchaseTemplateItemInput): Promise<DataResult<ServicePurchaseTemplateItem>>;
  removeServicePurchaseTemplateItem(id: string): Promise<DataResult<null>>;

  listServiceVendorSuggestions(serviceVersionId: string): Promise<ServiceVendorSuggestion[]>;
  createServiceVendorSuggestion(serviceVersionId: string, input: ServiceVendorSuggestionInput): Promise<DataResult<ServiceVendorSuggestion>>;
  updateServiceVendorSuggestion(id: string, input: ServiceVendorSuggestionInput): Promise<DataResult<ServiceVendorSuggestion>>;
  removeServiceVendorSuggestion(id: string): Promise<DataResult<null>>;

  listServiceTeamRoleRequirements(serviceVersionId: string): Promise<ServiceTeamRoleRequirement[]>;
  createServiceTeamRoleRequirement(serviceVersionId: string, input: ServiceTeamRoleRequirementInput): Promise<DataResult<ServiceTeamRoleRequirement>>;
  updateServiceTeamRoleRequirement(id: string, input: ServiceTeamRoleRequirementInput): Promise<DataResult<ServiceTeamRoleRequirement>>;
  removeServiceTeamRoleRequirement(id: string): Promise<DataResult<null>>;

  listServiceSeasonalWindows(serviceVersionId: string): Promise<ServiceSeasonalWindow[]>;
  createServiceSeasonalWindow(serviceVersionId: string, input: ServiceSeasonalWindowInput): Promise<DataResult<ServiceSeasonalWindow>>;
  updateServiceSeasonalWindow(id: string, input: ServiceSeasonalWindowInput): Promise<DataResult<ServiceSeasonalWindow>>;
  removeServiceSeasonalWindow(id: string): Promise<DataResult<null>>;

  listServiceCapabilityRequirements(serviceVersionId: string): Promise<ServiceCapabilityRequirement[]>;
  createServiceCapabilityRequirement(serviceVersionId: string, input: ServiceCapabilityRequirementInput): Promise<DataResult<ServiceCapabilityRequirement>>;
  updateServiceCapabilityRequirement(id: string, input: ServiceCapabilityRequirementInput): Promise<DataResult<ServiceCapabilityRequirement>>;
  removeServiceCapabilityRequirement(id: string): Promise<DataResult<null>>;

  listEventServicesByEvent(eventId: string): Promise<EventService[]>;
  /** All bookings of this catalog Service across every Event, regardless of which ServiceVersion got pinned at assignment time — the Event Assignment tab's one data source. */
  listEventServicesByService(serviceId: string): Promise<EventService[]>;
  getEventService(id: string): Promise<EventService>;
  assignServiceToEvent(eventId: string, input: AssignServiceToEventInput): Promise<DataResult<EventService>>;
  removeEventService(id: string): Promise<DataResult<null>>;
  transitionEventServiceStatus(id: string, to: EventServiceStatus): Promise<DataResult<EventService>>;
  /** Edits only the live, overridable `name`/`price_minor` fields — never `name_template_value`/`price_template_value`, the pinned `service_version_id`, or any catalog Service/ServiceVersion record. Rejected once the EventService is in a terminal status (`completed`/`cancelled`) — see `canOverrideEventService`. */
  updateEventServiceOverrides(id: string, input: UpdateEventServiceOverridesInput): Promise<DataResult<EventService>>;

  /**
   * One batched count per Service, never one query per row — callers pass
   * every id they need in a single call (e.g. one page of the Catalog).
   * `usageCount` excludes `cancelled` EventServices (see
   * core/workflows/eventServiceWorkflow.ts's own doc comment on this
   * definition) — a cancelled booking no longer represents real demand for
   * the Service. Workspace-scoped like every other read here. A Service id
   * with zero matching EventServices is simply absent from the returned
   * record (never an explicit `0` entry) — callers should default a missing
   * key to `0`.
   */
  getServiceUsageCounts(serviceIds: string[]): Promise<Record<string, number>>;

  listEventServiceInventoryRequirements(eventServiceId: string): Promise<EventServiceInventoryRequirement[]>;
  fulfillEventServiceInventoryRequirement(id: string): Promise<DataResult<EventServiceInventoryRequirement>>;

  listEventServicePurchaseRequirements(eventServiceId: string): Promise<EventServicePurchaseRequirement[]>;
  linkEventServicePurchaseRequirementToPurchase(id: string, purchaseId: string): Promise<DataResult<EventServicePurchaseRequirement>>;

  listEventServiceBudgetLines(eventServiceId: string): Promise<EventServiceBudgetLine[]>;
  listEventServiceTeamRequirements(eventServiceId: string): Promise<EventServiceTeamRequirement[]>;

  listEventServiceVendorAssignments(eventServiceId: string): Promise<EventServiceVendorAssignment[]>;
  confirmEventServiceVendorAssignment(id: string): Promise<DataResult<EventServiceVendorAssignment>>;
  declineEventServiceVendorAssignment(id: string): Promise<DataResult<EventServiceVendorAssignment>>;

  listEventServiceQuestionnaireResponses(eventServiceId: string): Promise<EventServiceQuestionnaireResponse[]>;
  submitEventServiceQuestionnaireResponse(eventServiceId: string, input: EventServiceQuestionnaireResponseInput): Promise<DataResult<EventServiceQuestionnaireResponse>>;

  getTimelineByServiceId(serviceId: string): Promise<TimelineActivity[]>;
  getNotesByServiceId(serviceId: string): Promise<Note[]>;
  createServiceNote(serviceId: string, input: NoteFormInput): Promise<DataResult<Note>>;
  updateServiceNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note> | null>;
  toggleServiceNotePin(noteId: string): Promise<DataResult<Note> | null>;

  getTimelineByEventServiceId(eventServiceId: string): Promise<TimelineActivity[]>;
  getNotesByEventServiceId(eventServiceId: string): Promise<Note[]>;
  createEventServiceNote(eventServiceId: string, input: NoteFormInput): Promise<DataResult<Note>>;
  updateEventServiceNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note> | null>;
  toggleEventServiceNotePin(noteId: string): Promise<DataResult<Note> | null>;
}
