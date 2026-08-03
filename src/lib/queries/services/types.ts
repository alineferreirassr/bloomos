import type { ServiceFilters } from "@/lib/data/services/repository";
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
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Event } from "@/types/event";
import type { Client } from "@/types/client";

/**
 * Every shape a Services screen will eventually consume, composed once here
 * rather than assembled ad hoc inside a component. This file has no
 * dependency on React or React Query — it is pure data shape.
 */

export interface ServiceHealthSummary {
  /** 0–100, rounded. See health.ts for the weighting this is built from. */
  percent: number;
  /** Ordered, most-important-first; each entry names a genuinely-missing "usually expected" signal, never an optional one. */
  missing: ServiceHealthMissingItem[];
}

export interface ServiceHealthMissingItem {
  label: string;
  /** Where the UI should deep-link to fix this — a template category, or the Draft Version form itself. */
  jumpTo: { kind: "templateCategory"; category: TemplateCategoryKey } | { kind: "draftVersionForm" };
}

export const TEMPLATE_CATEGORY_KEYS = [
  "includedItems",
  "addOns",
  "checklistItems",
  "timelineItems",
  "travelItems",
  "questionnaireQuestions",
  "requiredDocuments",
  "approvalItems",
  "inventoryItems",
  "purchaseItems",
  "vendorSuggestions",
  "teamRoleRequirements",
  "capabilityRequirements",
  "budgetLines",
  "seasonalWindows",
  "aiKnowledgeItems",
] as const;
export type TemplateCategoryKey = (typeof TEMPLATE_CATEGORY_KEYS)[number];

export interface ServiceCatalogRow {
  service: Service;
  categoryName: string | null;
  draftVersion: ServiceVersion;
  publishedVersion: ServiceVersion | null;
  health: ServiceHealthSummary;
  /** Count of non-cancelled EventServices pinned to this Service — see core/workflows/eventServiceWorkflow.ts's countsTowardServiceUsage for the exact definition. */
  usageCount: number;
}

export interface ServicesCatalogResult {
  rows: ServiceCatalogRow[];
  categories: ServiceCategory[];
}

/**
 * `ServiceFilters` (repository-level) only ever reaches `listServices` —
 * `usage`/`sortBy` are query-layer-only concerns layered on top, since
 * honoring them requires combining the base Service list with a second,
 * separate usage-count read the repository has no join to produce itself.
 * The repository never sees these two fields.
 */
export interface ServicesCatalogFilters extends ServiceFilters {
  /** "assigned" = usageCount > 0, "unassigned" = usageCount === 0. Applied after usage counts are merged in, never pushed down to listServices. */
  usage?: "all" | "assigned" | "unassigned";
  sortBy?: "name" | "health" | "usage" | "updatedAt";
}

export interface ServiceEditorData {
  service: Service;
  draftVersion: ServiceVersion;
  publishedVersion: ServiceVersion | null;
  health: ServiceHealthSummary;
  recentTimeline: TimelineActivity[];
  usageCount: number;
}

export interface VersionHistoryRow {
  version: ServiceVersion;
  isCurrentDraft: boolean;
}

export interface VersionHistoryResult {
  service: Service;
  rows: VersionHistoryRow[];
}

export interface TemplateCategoryData<TRow = unknown> {
  key: TemplateCategoryKey;
  rows: TRow[];
  count: number;
  /** "expected" categories drive the amber-vs-gray dot in the Template Builder sidebar and feed the health heuristic; "optional" ones never do. */
  expectation: "optional" | "expected";
}

export interface TemplateGroupData {
  groupName: string;
  categories: TemplateCategoryData[];
}

export interface TemplateBuilderData {
  serviceVersionId: string;
  isEditable: boolean;
  groups: TemplateGroupData[];
}

/**
 * Deliberately distinct from `ServiceHealthSummary` — Health scores
 * recommended-but-optional signal quality across weighted categories;
 * this is a plain ratio of "expected" template categories that have at
 * least one row, mirroring the exact formula `TemplateBuilderSidebar`
 * already renders (see templateCompletion.ts) so the two never drift.
 */
export interface TemplateCompletionSummary {
  percent: number;
  requiredComplete: number;
  requiredTotal: number;
  optionalUsed: number;
  optionalTotal: number;
  /** Human-readable labels (from templateCategoryAdapters), not raw keys — ready to render as-is. */
  missingRequiredCategories: string[];
}

export interface PublishPreview {
  serviceId: string;
  draftVersionId: string;
  /** Snapshot of the draft's `updated_at` at preview-fetch time — the dialog compares this against the live draft to detect "the draft changed since you opened this preview" without recomputing any validation itself. */
  draftVersionUpdatedAt: string;
  nextVersionNumber: number;
  /** null if this Service has never been published before. */
  currentPublishedVersionNumber: number | null;
  health: ServiceHealthSummary;
  templateCompletion: TemplateCompletionSummary;
  /** The 16-category keys that have at least one row in the draft — "what this version will actually include." */
  affectedCategories: TemplateCategoryKey[];
  /**
   * Structural violations that must be fixed before publishing (currently:
   * wrong version status, invalid base price) — see
   * canPublishServiceVersion in core/workflows/serviceWorkflow.ts, the one
   * place this rule is computed. Never includes completeness/quality
   * concerns; those are warnings instead.
   */
  blockingErrors: string[];
  /** Non-blocking: missing "expected" template categories, incomplete health signals. Publish remains allowed. */
  warnings: string[];
  canPublish: boolean;
}

export interface AssignmentCandidate {
  service: Service;
  publishedVersion: ServiceVersion;
  health: ServiceHealthSummary;
}

export interface AssignmentWorkspaceData {
  eligibleServices: AssignmentCandidate[];
  alreadyAssigned: EventService[];
}

export interface AssignmentPreview {
  service: Service;
  resolvedVersion: ServiceVersion;
  computedPriceMinor: number;
  generatedCounts: {
    checklistItems: number;
    scheduleItems: number;
    inventoryRequirements: number;
    purchaseRequirements: number;
    budgetLines: number;
    teamRequirements: number;
    vendorAssignments: number;
  };
}

export interface EventServiceWorkspaceData {
  eventService: EventService;
  event: Event;
  client: Client;
  /** The pinned ServiceVersion this EventService was assigned from — always the exact version `eventService.service_version_id` points at, never the catalog Service's current draft/published version (same pinning rule `listServiceQuestionnaireQuestions` already follows a few lines below). */
  version: ServiceVersion;
  isNameOverridden: boolean;
  isPriceOverridden: boolean;
  requirements: {
    inventory: EventServiceInventoryRequirement[];
    purchase: EventServicePurchaseRequirement[];
    budget: EventServiceBudgetLine[];
    team: EventServiceTeamRequirement[];
    vendor: EventServiceVendorAssignment[];
  };
  fulfillmentSummary: { resolved: number; total: number };
  questionnaire: Array<{ question: ServiceQuestionnaireQuestion; response: EventServiceQuestionnaireResponse | null }>;
  notes: Note[];
  timeline: TimelineActivity[];
}

/**
 * One row of the Event Assignment table — one EventService, joined with
 * just enough of its Event/Client to render "Event / Client / Date" and
 * just enough of its requirement rows to render "Assigned team" /
 * "Completion", without pulling in the heavier questionnaire/notes/timeline
 * data `EventServiceWorkspaceData` also carries (that stays lazy, fetched
 * only for whichever row the detail panel has selected — see
 * `useEventServiceWorkspace`). `isNameOverridden`/`isPriceOverridden` are
 * plain field comparisons already available on `eventService` itself, so
 * they cost nothing extra to include here.
 */
export interface ServiceAssignmentRow {
  eventService: EventService;
  event: Event;
  client: Client;
  /** `null` only if the pinned `service_version_id` has since been deleted — never true for an EventService created through the normal assignment flow. */
  versionNumber: number | null;
  isNameOverridden: boolean;
  isPriceOverridden: boolean;
  team: { resolved: number; total: number };
  completion: { resolved: number; total: number };
}

export interface ServiceAssignmentsResult {
  service: Service;
  rows: ServiceAssignmentRow[];
}

export interface HealthDashboardRow {
  service: Service;
  categoryName: string | null;
  health: ServiceHealthSummary;
}

export interface HealthDashboardData {
  rows: HealthDashboardRow[];
  averagePercent: number;
  belowThresholdCount: number;
}

/** Re-exported so callers of the query layer never need to reach into every individual template type module themselves. */
export type {
  ServiceCategory,
  Service,
  ServiceVersion,
  ServiceIncludedItem,
  ServiceAddOn,
  ServiceChecklistTemplateItem,
  ServiceTimelineTemplateItem,
  ServiceQuestionnaireQuestion,
  ServiceBudgetTemplateLine,
  ServiceApprovalTemplateItem,
  ServiceTravelTemplateItem,
  ServiceAiKnowledgeItem,
  ServiceRequiredDocument,
  ServiceInventoryTemplateItem,
  ServicePurchaseTemplateItem,
  ServiceVendorSuggestion,
  ServiceTeamRoleRequirement,
  ServiceSeasonalWindow,
  ServiceCapabilityRequirement,
  EventService,
};
