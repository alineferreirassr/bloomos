import type { KnowledgeNodeRef, KnowledgeNodeType } from "@/types/knowledgeGraph";
import type { AppointmentPriority } from "@/types/scheduling";

/**
 * v2.0 Checkpoint 27.1 — Resource Allocation Platform. Capability
 * determines WHO is eligible (Checkpoint 26.1); Scheduling determines
 * WHEN work can happen (Checkpoint 27); this checkpoint determines WHICH
 * combination of resources should perform the work — planning only.
 * Dispatch (a future checkpoint) determines WHO is actually sent. Every
 * engine in this domain is a pure, deterministic function; no AI, no
 * randomness, no worker dispatch, no route optimization, no live GPS.
 *
 * Reuse discipline: an `AllocationRequest`'s capability need is a
 * reference (`capability_requirement_id`) to a real, already-evaluated
 * `CapabilityRequirement` (Checkpoint 26.1) — never a re-declared set of
 * skill/certification fields. Its time need is a plain interval
 * (`required_starts_at`/`required_ends_at`), consumed by Checkpoint 27's
 * `AvailabilityWindowEngine`/`ConflictEngine` directly — never a
 * duplicated scheduling model.
 */

export const RESOURCE_TYPES = ["worker", "team", "equipment", "vehicle", "asset", "vendor", "custom"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** `"asset"`/`"custom"` have no real `KnowledgeNodeType` of their own the way `worker`/`team`/`equipment`/`vehicle`/`vendor` do — same "don't fabricate a node" discipline `CALENDAR_CONTEXTS_WITH_NO_NODE` established. Checkpoint 25's DAM uses `"media_asset"`, a distinct concept from a generic allocatable "asset" resource. */
export const RESOURCE_TYPES_WITH_NO_NODE: readonly ResourceType[] = ["asset", "custom"];

export const RESOURCE_TYPE_TO_NODE_TYPE: Partial<Record<ResourceType, KnowledgeNodeType>> = {
  worker: "worker",
  team: "team",
  equipment: "equipment",
  vehicle: "vehicle",
  vendor: "vendor",
};

export const ALLOCATION_STATUSES = ["draft", "proposed", "approved", "failed", "archived"] as const;
export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number];

/** Reuses `AppointmentPriority`'s exact scale — an allocation's urgency is the same concept as an appointment's. */
export type AllocationPriority = AppointmentPriority;

export const ALLOCATION_STRATEGIES = ["highest_capability", "lowest_cost", "balanced_workload", "least_busy", "preferred_team", "preferred_worker", "custom"] as const;
export type AllocationStrategy = (typeof ALLOCATION_STRATEGIES)[number];

export const ALLOCATION_SOURCES = ["manual", "bundle_template", "system_recommended"] as const;
export type AllocationSource = (typeof ALLOCATION_SOURCES)[number];

export const ALLOCATION_REQUEST_CONTEXT_TYPES = ["event", "client", "project_placeholder", "custom"] as const;
export type AllocationRequestContextType = (typeof ALLOCATION_REQUEST_CONTEXT_TYPES)[number];
export const ALLOCATION_REQUEST_CONTEXTS_WITH_NO_NODE: readonly AllocationRequestContextType[] = ["project_placeholder", "custom"];
export const ALLOCATION_REQUEST_CONTEXT_TYPE_TO_NODE_TYPE: Partial<Record<AllocationRequestContextType, KnowledgeNodeType>> = {
  event: "event",
  client: "client",
};

/** One line of "we need N of this resource type, optionally matching this capability requirement." */
export interface AllocationRequirementLine {
  resource_type: ResourceType;
  quantity: number;
  /** References a real, already-built Checkpoint 26.1 `CapabilityRequirement` — `null` when this line has no capability need beyond the resource type itself (e.g. "1 vehicle," no license requirement). */
  capability_requirement_id: string | null;
  preferred_resource_ids: string[];
  notes: string | null;
}

export interface AllocationRequest {
  id: string;
  workspace_id: string;
  context_type: AllocationRequestContextType;
  context: KnowledgeNodeRef | null;
  required_resources: AllocationRequirementLine[];
  required_starts_at: string;
  required_ends_at: string;
  /** `null` when the request isn't yet tied to a specific calendar — `AvailabilityWindowEngine` checks are skipped, never fabricated, until one is set. */
  calendar_id: string | null;
  priority: AllocationPriority;
  deadline: string | null;
  location_placeholder: string | null;
  special_instructions: string | null;
  /** Set only when this request was generated from a `ResourceBundle` template. */
  bundle_id: string | null;
  source: AllocationSource;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AllocationCandidate {
  resource_type: ResourceType;
  resource_id: string;
  requirement_line_index: number;
  selected: boolean;
  /** Populated only when `selected: false` — never a bare boolean with no reason. */
  rejection_reason: string | null;
  is_fallback: boolean;
  /** `null` for a primary pick; `1` = first backup, `2` = second backup, etc. */
  fallback_tier: number | null;
}

export interface Allocation {
  id: string;
  workspace_id: string;
  request_id: string;
  /** Distinguishes multiple proposals generated for the same request (Proposal A/B/C) so they can be compared — proposals sharing a `group_id` are alternatives, never duplicates of each other. */
  group_id: string;
  strategy: AllocationStrategy;
  status: AllocationStatus;
  candidates: AllocationCandidate[];
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
  archived_at: string | null;
}

export const BUNDLE_STATUSES = ["active", "archived"] as const;
export type BundleStatus = (typeof BUNDLE_STATUSES)[number];

export interface BundleResourceLine {
  resource_type: ResourceType;
  quantity: number;
  capability_requirement_id: string | null;
  notes: string | null;
}

export interface ResourceBundle {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  required_resources: BundleResourceLine[];
  optional_resources: BundleResourceLine[];
  min_quantity: number;
  max_quantity: number | null;
  status: BundleStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

/** A dependency rule: a resource of `subject_resource_type` (optionally narrowed to a specific `subject_identifier`, e.g. an Equipment `category`) requires a co-allocated resource meeting `requires_skill`/`requires_certification`. Never a duplicate of Checkpoint 26.1's `CapabilityRequirement` — a dependency rule is reusable registry data, not a per-request requirement. */
export interface DependencyRule {
  id: string;
  workspace_id: string;
  subject_resource_type: ResourceType;
  subject_identifier: string | null;
  requires_resource_type: ResourceType;
  requires_skill: string | null;
  requires_certification: string | null;
  description: string;
}

export interface DependencyCheckResult {
  rule: DependencyRule;
  satisfied: boolean;
  /** The resource id that satisfied the dependency, if any. */
  satisfiedByResourceId: string | null;
}

export interface FallbackChain {
  requirement_line_index: number;
  primary: { resource_type: ResourceType; resource_id: string } | null;
  backups: Array<{ resource_type: ResourceType; resource_id: string; tier: number }>;
}

// ---- Computed results (never stored) ----

export interface AllocationScores {
  capabilityFitScore: number;
  scheduleFitScore: number;
  availabilityFitScore: number;
  bundleCompletenessScore: number;
  dependencyHealthScore: number;
  capacityHealthScore: number;
  preferenceMatchScore: number;
  overallAllocationScore: number;
}

export interface AllocationValidationIssue {
  rule: string;
  detail: string;
}

export interface AllocationValidationResult {
  valid: boolean;
  errors: AllocationValidationIssue[];
  warnings: AllocationValidationIssue[];
}

export interface AllocationExplanation {
  summary: string;
  selectedReasons: string[];
  rejectedReasons: string[];
  missingResources: string[];
  constraintFailures: string[];
  fallbacksUsed: string[];
  bundleCompletion: string;
}

export interface AllocationResult {
  allocation: Allocation;
  scores: AllocationScores;
  validation: AllocationValidationResult;
  explanation: AllocationExplanation;
}

export interface AllocationComparisonEntry {
  allocationId: string;
  strategy: AllocationStrategy;
  scores: AllocationScores;
  strengths: string[];
  weaknesses: string[];
}

export interface AllocationComparisonResult {
  entries: AllocationComparisonEntry[];
  differences: string[];
}

export const RESOURCE_POOL_STATES = ["available", "reserved", "busy", "unavailable"] as const;
export type ResourcePoolState = (typeof RESOURCE_POOL_STATES)[number];

export interface ResourcePoolEntry {
  resource_type: ResourceType;
  resource_id: string;
  state: ResourcePoolState;
  /** `true` when this resource appears in more than one active allocation's candidates — a shared resource, not necessarily a conflict by itself. */
  isShared: boolean;
  /** `true` when this resource is a documented single point of failure — the only one of its kind meeting some active requirement. */
  isCritical: boolean;
}

export interface ResourcePoolSnapshot {
  entries: ResourcePoolEntry[];
  availableCount: number;
  reservedCount: number;
  busyCount: number;
  unavailableCount: number;
  sharedCount: number;
  criticalCount: number;
}

export const ALLOCATION_FINDING_TYPES = ["insufficient_resources", "critical_dependency", "bundle_incomplete", "resource_bottleneck", "shared_resource_conflict", "fallback_activated", "no_allocation_possible", "resource_shortage"] as const;
export type AllocationFindingType = (typeof ALLOCATION_FINDING_TYPES)[number];

export const ALLOCATION_FINDING_SEVERITIES = ["low", "medium", "high"] as const;
export type AllocationFindingSeverity = (typeof ALLOCATION_FINDING_SEVERITIES)[number];

export interface AllocationFinding {
  id: string;
  type: AllocationFindingType;
  severity: AllocationFindingSeverity;
  description: string;
  relatedRequestId: string | null;
  relatedAllocationId: string | null;
  relatedResourceId: string | null;
}
