import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { DecisionPriority } from "@/types/executiveDecisions";
import type { TimelineActivity } from "@/types/timelineActivity";

/**
 * v2.0 Checkpoint 31 — Real-Time Operations Center. The final operational
 * kernel layer. It observes and coordinates — it never creates planning
 * decisions, recalculates capability/scheduling/allocation, rebuilds
 * operational plans/execution packages, dispatches workers, changes
 * execution state, optimizes routes, tracks GPS, or sends external
 * notifications. No AI, no external realtime provider, no new source of
 * truth: every figure here traces back to an existing module's own
 * already-computed result.
 *
 * Storage split, disclosed: almost everything in this domain is
 * **computed fresh on every read** (`OperationalSnapshot`, `OperationalSignal`,
 * `OperationalFeedItem`, `OperationalKpiSnapshot`, health/priority-queue/
 * resource-overview/brief results) — never persisted, since persisting a
 * second copy of Dispatch/Field Operations/Route data would itself be the
 * "second source of truth" the objective forbids. The two genuinely new,
 * stateful concepts this checkpoint introduces — `OperationalAlert` (has
 * its own lifecycle: open → acknowledged/dismissed/escalated →
 * resolved/expired) and `OperationalIncident` (groups alerts, has its own
 * lifecycle and owner) — are the only two persisted entities, the same
 * "own your own new aggregate root, reuse everyone else's" precedent
 * every prior checkpoint in this series established.
 *
 * "Operations Center" itself (the spec's own Step 1 noun) is not a
 * separate stored/computed struct — it is the platform as a whole,
 * satisfied by the sum of `core/operationsCenter`'s engines and
 * `modules/operationsCenter/operationsCenterActions.ts`'s own accessor,
 * the same "the platform is the sum of its engines" precedent
 * `docs/field-operations.md` already established for its own top-level
 * noun.
 *
 * `OperationalSeverity` reuses `DecisionPriority` directly (never a
 * second severity scale) — Operations Center sits at the same executive
 * altitude as Executive Decisions and explicitly names "Critical Alerts"/
 * "Critical Executive Decision" throughout its own spec.
 */

export type OperationalSeverity = DecisionPriority;

export const OPERATIONAL_STATUSES = ["normal", "attention", "at_risk", "critical", "degraded", "unknown"] as const;
export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];

export const OPERATIONAL_CATEGORIES = ["dispatch", "field_operations", "route_optimization", "scheduling", "allocation", "execution_package", "workforce", "executive_decisions", "objectives", "business_health", "knowledge_health", "communication", "timeline"] as const;
export type OperationalCategory = (typeof OPERATIONAL_CATEGORIES)[number];

export const OPERATIONAL_VIEWS = ["owner", "team", "mobile"] as const;
export type OperationalView = (typeof OPERATIONAL_VIEWS)[number];

// ---- Cross-Module Aggregation (Step 3) ----

/** One entry per source the Aggregation Engine reads from — mirrors `OperationalCategory` for every source that has a public module action to call. */
export const OPERATIONAL_SOURCES = ["dispatch", "field_operations", "route_optimization", "scheduling", "allocation", "execution_package", "workforce", "capability", "executive_decisions", "objectives", "business_health", "knowledge_health", "timeline"] as const;
export type OperationalSource = (typeof OPERATIONAL_SOURCES)[number];

/**
 * `successful` — the module's own public action resolved `{success:true}`
 * just now. `failed` — it resolved `{success:false, error}`, an
 * anticipated business-level failure (e.g. access denied). `unavailable` —
 * the call itself threw/rejected unexpectedly (a crash, not a business
 * answer). `stale` — the current call failed or was unavailable, but a
 * previously successful result is cached and served instead, flagged
 * stale rather than blanking the whole Operations Center over one bad
 * source — "one failing source must not blank the entire Operations
 * Center" (the spec's own Step 3 line).
 */
export const OPERATIONAL_SOURCE_STATES = ["successful", "failed", "unavailable", "stale"] as const;
export type OperationalSourceState = (typeof OPERATIONAL_SOURCE_STATES)[number];

export interface SourceOutcome<T> {
  source: OperationalSource;
  state: OperationalSourceState;
  data: T | null;
  error: string | null;
  /** When this data was actually fetched — for `stale`, this is the last successful fetch, not now. `null` when no data has ever been fetched successfully. */
  fetchedAt: string | null;
}

// ---- Operational Snapshot (Step 2) ----

export interface LiveOperationSummary {
  activeDispatchOrders: number;
  pendingAssignments: number;
  acceptedAssignments: number;
  declinedAssignments: number;
  expiredAssignments: number;
  activeFieldOperations: number;
  pausedFieldOperations: number;
  blockedFieldOperations: number;
  completedFieldOperations: number;
  activeRoutes: number;
  highRiskRoutes: number;
}

export interface OperationalSnapshot {
  workspaceId: string;
  generatedAt: string;
  /** 0-100 — the share of sources that answered successfully this snapshot, `stale` sources counted at half weight since their data is real but old. */
  confidence: number;
  sourceOutcomes: SourceOutcome<unknown>[];
  liveOperations: LiveOperationSummary;
  schedulingConflicts: number;
  capacityAlerts: number;
  allocationRisks: number;
  executionPackagesNotReady: number;
  workersAvailable: number;
  workersUnavailable: number;
  equipmentAvailable: number;
  equipmentUnavailable: number;
  vehiclesAvailable: number;
  vehiclesUnavailable: number;
  criticalExecutiveDecisions: number;
  blockedObjectives: number;
  businessHealthScore: number;
  knowledgeHealthScore: number;
  recentTimelineActivity: TimelineActivity[];
}

// ---- Operational Signal (computed, pre-Alert) ----

/**
 * The ephemeral, computed-only detection unit the Alert Engine produces
 * every evaluation — never stored itself. A `Signal` is promoted into a
 * persisted `OperationalAlert` only when `AlertLifecycleEngine.reconcileAlerts`
 * runs it through the store.
 *
 * `sourceRef` points at a real Knowledge Graph node when the signal's own
 * record has one (a `worker`/`equipment`/`vehicle`/`event`, etc.) — `null`
 * otherwise, since Dispatch/Field Operations/Route Optimization/Scheduling/
 * Allocation/Execution Package/Executive Decisions/Objectives records have
 * no `EntityType` of their own yet (the same "0 live" disclosure Route
 * Optimization's own Knowledge Graph section makes). `sourceRecordId` is
 * the plain, type-unconstrained id of the exact record that triggered the
 * signal regardless of whether a `KnowledgeNodeType` exists for it — this
 * is what actually satisfies Step 5's "each alert references the exact
 * source record" requirement, and what the dedupe key is keyed on so two
 * different records tripping the same rule never collapse into one alert.
 */
export interface OperationalSignal {
  ruleId: string;
  category: OperationalCategory;
  severity: OperationalSeverity;
  title: string;
  description: string;
  sourceRef: KnowledgeNodeRef | null;
  sourceRecordId: string | null;
  occurredAt: string;
}

// ---- Operational Alert (Steps 5-6) — stored, has lifecycle ----

export const ALERT_STATUSES = ["open", "acknowledged", "resolved", "dismissed", "escalated", "expired"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export interface OperationalAlert {
  id: string;
  workspace_id: string;
  rule_id: string;
  category: OperationalCategory;
  severity: OperationalSeverity;
  title: string;
  description: string;
  source_ref: KnowledgeNodeRef | null;
  /** Carried straight from `OperationalSignal.sourceRecordId` — see that field's own comment for why this exists alongside `source_ref`. */
  source_record_id: string | null;
  status: AlertStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_reason: string | null;
  dismissed_at: string | null;
  escalated_at: string | null;
  expires_at: string | null;
  /** A stable key (`rule_id` + `sourceRecordId`/`sourceRef`) so re-running the Alert Engine against a still-present condition reconciles with the existing open alert rather than creating a duplicate — the same discipline `Decision.dedupe_key` established in Executive Decisions. */
  dedupe_key: string;
  created_at: string;
  updated_at: string;
}

// ---- Operational Incident (Step 7) — stored, groups alerts ----

export const INCIDENT_STATUSES = ["open", "acknowledged", "resolved"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export interface OperationalIncident {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  severity: OperationalSeverity;
  status: IncidentStatus;
  source_alert_ids: string[];
  related_dispatch_order_ids: string[];
  related_field_operation_ids: string[];
  related_route_plan_ids: string[];
  related_worker_ids: string[];
  related_vehicle_ids: string[];
  related_equipment_ids: string[];
  owner_member_id: string | null;
  resolution_notes: string | null;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  updated_at: string;
}

// ---- Operational Feed (Step 8) — computed ----

export interface OperationalFeedItem {
  id: string;
  category: OperationalCategory;
  severity: OperationalSeverity | null;
  description: string;
  occurredAt: string;
  sourceRef: KnowledgeNodeRef | null;
  relatedAlertId: string | null;
  relatedIncidentId: string | null;
  pinned: boolean;
  deepLink: string | null;
}

// ---- Operations KPIs (Step 9) — computed, no placeholders ----

export interface OperationalKpiSnapshot {
  activeOperations: number;
  pausedOperations: number;
  blockedOperations: number;
  pendingAcceptances: number;
  declineRate: number;
  dispatchQueueHealth: number;
  routeHealth: number;
  highRiskRoutes: number;
  schedulingConflicts: number;
  capacityUsage: number;
  availableWorkers: number;
  unavailableWorkers: number;
  equipmentInUse: number;
  vehiclesInUse: number;
  criticalAlerts: number;
  openIncidents: number;
  averageExecutionHealth: number;
  overallOperationalStatus: OperationalStatus;
}

// ---- Operations Center Health Composition (Step 10) ----

export interface OperationsCenterHealthScores {
  dispatchHealth: number;
  executionHealth: number;
  routeHealth: number;
  schedulingHealth: number;
  allocationHealth: number;
  packageHealth: number;
  workforceHealth: number;
  businessHealth: number;
  knowledgeHealth: number;
  objectiveHealth: number;
  overallOperationsCenterHealth: number;
}

// ---- Operational Priority Queue (Step 11) — computed ----

export const PRIORITY_QUEUE_ITEM_TYPES = ["alert", "incident", "executive_decision", "objective", "operation", "route", "acceptance", "scheduling_conflict", "bottleneck"] as const;
export type PriorityQueueItemType = (typeof PRIORITY_QUEUE_ITEM_TYPES)[number];

export interface PriorityQueueItem {
  id: string;
  type: PriorityQueueItemType;
  severity: OperationalSeverity;
  title: string;
  description: string;
  sourceRef: KnowledgeNodeRef | null;
  deepLink: string | null;
}

// ---- Resource Overview (Step 12) — computed, reuses Workforce/Capability only ----

export interface ResourceOverview {
  workersAvailable: number;
  workersBusy: number;
  workersOffline: number;
  workersInActiveOperations: number;
  teamsActive: number;
  equipmentAvailable: number;
  equipmentAssigned: number;
  equipmentUnavailable: number;
  vehiclesAvailable: number;
  vehiclesAssigned: number;
  vehiclesUnavailable: number;
  criticalSinglePointsOfFailure: string[];
}

// ---- Operational Map Placeholder (Step 13) — list-based only, never a real map ----

export interface OperationalLocationSummary {
  knownWorkerLocationsCount: number;
  knownOperationLocationsCount: number;
  knownRouteWaypointsCount: number;
  unknownLocationCount: number;
  lastLocationTimestamp: string | null;
  locationAccuracySummary: string;
}

// ---- Deterministic Operations Brief (Step 16) ----

export interface OperationsBrief {
  generatedAt: string;
  currentOperationalSummary: string;
  criticalIssues: string[];
  pendingAcceptances: number;
  blockedWork: string[];
  highRiskRoutes: string[];
  capacityRisks: string[];
  resourceAvailabilitySummary: string;
  openIncidentsCount: number;
  topPriorities: string[];
  recentImprovements: string[];
  recentRegressions: string[];
}
