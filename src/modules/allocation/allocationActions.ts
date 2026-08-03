"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  getCoreAllocationRequestsService,
  getCoreAllocationsService,
  getCoreResourceBundlesService,
  getCoreDependencyRulesService,
  type CreateAllocationRequestInput,
  type CreateResourceBundleInput,
  type UpdateResourceBundleInput,
  type CreateDependencyRuleInput,
} from "@/core/allocation";
import { getCoreWorkersService, getCoreTeamsService, getCoreAvailabilityService, getCoreAssignmentsService, getCoreEquipmentService, getCoreVehiclesService, type Worker, type Team, type Equipment, type Vehicle, type Assignment, type AvailabilityWindow } from "@/core/workforce";
import { getCoreCalendarsService, getCoreWorkingHoursService, getCoreCalendarWindowsService, getCoreHolidaysService, getCoreCapacityRulesService } from "@/core/scheduling";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { getVendors } from "@/lib/data";
import { runCapabilityEvaluation } from "@/modules/capability/capabilityActions";
import { resolveCurrentAvailability } from "@/core/workforce/availabilityEngine";
import { resolveAvailabilityForInterval } from "@/core/scheduling/availabilityWindowEngine";
import { checkCapacity, type CapacityUsageEntry } from "@/core/scheduling/capacityEngine";
import { buildAllocationProposal, type CandidatePoolEntry } from "@/core/allocation/allocationEngine";
import { checkDependencies } from "@/core/allocation/dependencyEngine";
import { buildRequirementLinesFromBundle, evaluateBundleCompleteness, type BundleCompletenessResult } from "@/core/allocation/bundleEngine";
import { findSharedResourceConflicts, type ResourceUsageWindow } from "@/core/allocation/sharedResourceEngine";
import { validateAllocation, type CapacityCheckSummary } from "@/core/allocation/allocationValidationEngine";
import { computeAllocationScores } from "@/core/allocation/allocationScoreEngine";
import { explainAllocation } from "@/core/allocation/allocationExplanationEngine";
import { compareAllocations, type ComparisonProposalInput } from "@/core/allocation/allocationComparisonEngine";
import { resourceKey, buildResourcePoolSnapshot, detectCriticalResources, type EligiblePoolEntry } from "@/core/allocation/resourcePoolEngine";
import { allocationCreatedEvent, allocationRecalculatedEvent, allocationFallbackUsedEvent, allocationDependencyFailedEvent, allocationBundleCompletedEvent, allocationApprovedEvent, allocationArchivedEvent } from "@/core/allocation/allocationTimelineEngine";
import { buildAllocatedToRelationship, buildDependsOnRelationship, type AllocationRelationshipSpec } from "@/core/allocation/allocationKnowledgeGraphEngine";
import { detectAllocationRisks } from "@/core/allocation/allocationRiskEngine";
import { allocationFindingsToRecommendations } from "@/core/allocation/allocationFindingsEngine";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { generateId, nowIso } from "@/lib/data/utils";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { Vendor } from "@/types/vendor";
import type {
  AllocationRequest,
  Allocation,
  AllocationCandidate,
  AllocationRequirementLine,
  AllocationStrategy,
  ResourceBundle,
  DependencyRule,
  ResourceType,
  AllocationScores,
  AllocationValidationResult,
  AllocationResult,
  AllocationComparisonResult,
  AllocationFinding,
  ResourcePoolSnapshot,
  ResourcePoolState,
  DependencyCheckResult,
} from "@/types/allocation";

/**
 * v2.0 Checkpoint 27.1 — Resource Allocation Platform module layer. Never
 * re-derives eligibility/availability itself: workers are ranked via
 * Checkpoint 26.1's real `evaluateCapabilityRequirementAction`; calendar
 * openness via Checkpoint 27's real `resolveAvailabilityForInterval`/
 * `checkCapacity`. This file's own job is building the `CandidatePoolEntry`
 * pool for non-worker resource types (simple status checks — no capability
 * scoring engine exists yet for team/equipment/vehicle/vendor), then
 * composing every Checkpoint 27.1 engine into full CRUD + orchestration.
 */

const GENERIC_ACCESS_ERROR = "Resource Allocation isn't available. You may not have access to it.";
const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);
/** No cost/rate field exists anywhere in Workforce/Equipment/Vehicle/Vendor — same disclosed baseline `allocationEngine.ts` documents for `lowest_cost`. Used for resource types with no per-instance capability scoring engine (team/equipment/vehicle/vendor). */
const BASELINE_STATUS_ONLY_SCORE = 80;
/** A worker requirement line with no `capability_requirement_id` has nothing to score against — every active worker is treated as equally, provisionally eligible rather than fabricating a requirement to evaluate. */
const BASELINE_UNCONSTRAINED_WORKER_SCORE = 70;

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function recordAllocationTimelineEvent(workspaceId: string, node: KnowledgeNodeRef | null, event: { type: TimelineActivityType; description: string }): void {
  const ownerType = node?.nodeType ?? "workspace";
  const ownerId = node?.nodeId ?? workspaceId;
  if (!ENTITY_TYPE_SET.has(ownerType)) return;
  recordTimelineActivity(workspaceId, ownerType as EntityType, ownerId, event.type, event.description);
}

async function persistRelationship(workspaceId: string, createdBy: string, spec: AllocationRelationshipSpec | null): Promise<void> {
  if (spec === null) return;
  await getCoreKnowledgeGraphService().createRelationship(workspaceId, createdBy, {
    sourceNodeType: spec.sourceNode.nodeType,
    sourceNodeId: spec.sourceNode.nodeId,
    targetNodeType: spec.targetNode.nodeType,
    targetNodeId: spec.targetNode.nodeId,
    relationshipType: spec.relationshipType,
    source: "user_action",
  });
}

// ---- Resource Bundles ----

export async function createResourceBundleAction(input: CreateResourceBundleInput): Promise<ActionResult<ResourceBundle>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("allocations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreResourceBundlesService().createBundle(session.workspace.id, session.membership.id, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function listResourceBundlesAction(includeArchived = false): Promise<ActionResult<ResourceBundle[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const bundles = await getCoreResourceBundlesService().listBundlesForWorkspace(session.workspace.id, includeArchived);
  return { success: true, data: bundles };
}

export async function getResourceBundleAction(id: string): Promise<ActionResult<ResourceBundle>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const bundle = await getCoreResourceBundlesService().getBundleById(id);
  if (!bundle || bundle.workspace_id !== session.workspace.id) return { success: false, error: "This resource bundle could not be found." };
  return { success: true, data: bundle };
}

export async function updateResourceBundleAction(id: string, input: UpdateResourceBundleInput): Promise<ActionResult<ResourceBundle>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("allocations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreResourceBundlesService().updateBundle(id, session.workspace.id, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function archiveResourceBundleAction(id: string): Promise<ActionResult<ResourceBundle>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("allocations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreResourceBundlesService().setBundleStatus(id, session.workspace.id, "archived");
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function reactivateResourceBundleAction(id: string): Promise<ActionResult<ResourceBundle>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("allocations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreResourceBundlesService().setBundleStatus(id, session.workspace.id, "active");
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function duplicateResourceBundleAction(id: string): Promise<ActionResult<ResourceBundle>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("allocations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreResourceBundlesService().duplicateBundle(id, session.workspace.id, session.membership.id);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

// ---- Dependency Rules ----

export async function createDependencyRuleAction(input: CreateDependencyRuleInput): Promise<ActionResult<DependencyRule>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("allocations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreDependencyRulesService().createRule(session.workspace.id, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function listDependencyRulesAction(): Promise<ActionResult<DependencyRule[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const rules = await getCoreDependencyRulesService().listRulesForWorkspace(session.workspace.id);
  return { success: true, data: rules };
}

// ---- Allocation Requests ----

export async function createAllocationRequestAction(input: CreateAllocationRequestInput): Promise<ActionResult<AllocationRequest>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("allocations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  let requiredResources = input.required_resources;
  if (input.bundle_id !== null && requiredResources.length === 0) {
    const bundle = await getCoreResourceBundlesService().getBundleById(input.bundle_id);
    if (!bundle || bundle.workspace_id !== session.workspace.id) return { success: false, error: "This resource bundle could not be found." };
    requiredResources = buildRequirementLinesFromBundle(bundle);
  }

  const result = await getCoreAllocationRequestsService().createRequest(session.workspace.id, session.membership.id, { ...input, required_resources: requiredResources });
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function listAllocationRequestsAction(): Promise<ActionResult<AllocationRequest[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const requests = await getCoreAllocationRequestsService().listRequestsForWorkspace(session.workspace.id);
  return { success: true, data: requests };
}

export async function getAllocationRequestAction(id: string): Promise<ActionResult<AllocationRequest>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const request = await getCoreAllocationRequestsService().getRequestById(id);
  if (!request || request.workspace_id !== session.workspace.id) return { success: false, error: "This allocation request could not be found." };
  return { success: true, data: request };
}

// ---- Candidate pool construction ----

interface WorkspaceResourceContext {
  workers: Worker[];
  teams: Team[];
  equipment: Equipment[];
  vehicles: Vehicle[];
  vendors: Vendor[];
  assignments: Assignment[];
  availabilityWindows: AvailabilityWindow[];
  dependencyRules: DependencyRule[];
  allocations: Allocation[];
}

async function fetchWorkspaceResourceContext(workspaceId: string): Promise<WorkspaceResourceContext> {
  const [workers, teams, equipment, vehicles, vendors, allAssignments, availabilityWindows, dependencyRules, allAllocations] = await Promise.all([
    getCoreWorkersService().listWorkersForWorkspace(workspaceId, false),
    getCoreTeamsService().listTeamsForWorkspace(workspaceId, false),
    getCoreEquipmentService().listEquipmentForWorkspace(workspaceId, false),
    getCoreVehiclesService().listVehiclesForWorkspace(workspaceId, false),
    getVendors({ status: "active" }),
    getCoreAssignmentsService().listAssignmentsForWorkspace(workspaceId),
    getCoreAvailabilityService().listWindowsForWorkspace(workspaceId),
    getCoreDependencyRulesService().listRulesForWorkspace(workspaceId),
    getCoreAllocationsService().listAllocationsForWorkspace(workspaceId),
  ]);
  return {
    workers,
    teams,
    equipment,
    vehicles,
    vendors,
    assignments: allAssignments.filter((a) => a.status === "active"),
    availabilityWindows,
    dependencyRules,
    allocations: allAllocations.filter((a) => a.status !== "archived"),
  };
}

/** Real workload signal: how many currently-active allocations already selected this resource. Workers additionally carry real Assignment-based workload, checked separately. */
function buildResourceUsageCounts(allocations: Allocation[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const allocation of allocations) {
    for (const candidate of allocation.candidates) {
      if (!candidate.selected) continue;
      const key = resourceKey(candidate.resource_type, candidate.resource_id);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

async function buildWorkerPool(line: AllocationRequirementLine, ctx: WorkspaceResourceContext, workspaceId: string, memberId: string): Promise<CandidatePoolEntry[]> {
  const workloadFor = (workerId: string) => ctx.assignments.filter((a) => a.worker_id === workerId).length;

  if (line.capability_requirement_id !== null) {
    const result = await runCapabilityEvaluation(line.capability_requirement_id, workspaceId, memberId);
    if (!result.success) return [];
    return result.data.ranking.map((entry) => {
      const fit = entry.eligibility.state === "eligible" || entry.eligibility.state === "conditionally_eligible";
      return {
        resource_type: "worker" as const,
        resource_id: entry.workerId,
        eligible: fit,
        ineligibleReason: fit ? null : (entry.eligibility.blockingReasons[0]?.detail ?? "Not eligible for this capability requirement."),
        score: entry.scores.overallCapabilityScore,
        currentWorkload: workloadFor(entry.workerId),
        isPreferred: line.preferred_resource_ids.includes(entry.workerId),
      };
    });
  }

  return ctx.workers
    .filter((w) => w.status === "active")
    .map((w) => ({
      resource_type: "worker" as const,
      resource_id: w.id,
      eligible: true,
      ineligibleReason: null,
      score: BASELINE_UNCONSTRAINED_WORKER_SCORE,
      currentWorkload: workloadFor(w.id),
      isPreferred: line.preferred_resource_ids.includes(w.id),
    }));
}

function buildTeamPool(line: AllocationRequirementLine, ctx: WorkspaceResourceContext, usageCounts: Map<string, number>): CandidatePoolEntry[] {
  return ctx.teams
    .filter((t) => t.status === "active")
    .map((t) => ({
      resource_type: "team" as const,
      resource_id: t.id,
      eligible: true,
      ineligibleReason: null,
      score: BASELINE_STATUS_ONLY_SCORE,
      currentWorkload: usageCounts.get(resourceKey("team", t.id)) ?? 0,
      isPreferred: line.preferred_resource_ids.includes(t.id),
    }));
}

function buildEquipmentPool(line: AllocationRequirementLine, ctx: WorkspaceResourceContext, usageCounts: Map<string, number>): CandidatePoolEntry[] {
  return ctx.equipment.map((e) => ({
    resource_type: "equipment" as const,
    resource_id: e.id,
    eligible: e.status === "available",
    ineligibleReason: e.status === "available" ? null : `Equipment is currently ${e.status.replace("_", " ")}.`,
    score: BASELINE_STATUS_ONLY_SCORE,
    currentWorkload: usageCounts.get(resourceKey("equipment", e.id)) ?? 0,
    isPreferred: line.preferred_resource_ids.includes(e.id),
  }));
}

function buildVehiclePool(line: AllocationRequirementLine, ctx: WorkspaceResourceContext, usageCounts: Map<string, number>): CandidatePoolEntry[] {
  return ctx.vehicles.map((v) => ({
    resource_type: "vehicle" as const,
    resource_id: v.id,
    eligible: v.status === "available",
    ineligibleReason: v.status === "available" ? null : `Vehicle is currently ${v.status.replace("_", " ")}.`,
    score: BASELINE_STATUS_ONLY_SCORE,
    currentWorkload: usageCounts.get(resourceKey("vehicle", v.id)) ?? 0,
    isPreferred: line.preferred_resource_ids.includes(v.id),
  }));
}

function buildVendorPool(line: AllocationRequirementLine, ctx: WorkspaceResourceContext, usageCounts: Map<string, number>): CandidatePoolEntry[] {
  return ctx.vendors.map((v) => ({
    resource_type: "vendor" as const,
    resource_id: v.id,
    eligible: true,
    ineligibleReason: null,
    score: BASELINE_STATUS_ONLY_SCORE,
    currentWorkload: usageCounts.get(resourceKey("vendor", v.id)) ?? 0,
    isPreferred: line.preferred_resource_ids.includes(v.id),
  }));
}

/** `"asset"`/`"custom"` have no registry to allocate from this checkpoint — an empty pool (never a fabricated candidate), same disclosed limitation `RESOURCE_TYPES_WITH_NO_NODE` documents for Knowledge Graph. */
async function buildCandidatePoolsForRequest(request: AllocationRequest, ctx: WorkspaceResourceContext, usageCounts: Map<string, number>, workspaceId: string, memberId: string): Promise<CandidatePoolEntry[][]> {
  const pools: CandidatePoolEntry[][] = [];
  for (const line of request.required_resources) {
    switch (line.resource_type) {
      case "worker":
        pools.push(await buildWorkerPool(line, ctx, workspaceId, memberId));
        break;
      case "team":
        pools.push(buildTeamPool(line, ctx, usageCounts));
        break;
      case "equipment":
        pools.push(buildEquipmentPool(line, ctx, usageCounts));
        break;
      case "vehicle":
        pools.push(buildVehiclePool(line, ctx, usageCounts));
        break;
      case "vendor":
        pools.push(buildVendorPool(line, ctx, usageCounts));
        break;
      case "asset":
      case "custom":
        pools.push([]);
        break;
    }
  }
  return pools;
}

function resolveSubjectIdentifier(candidate: AllocationCandidate, ctx: WorkspaceResourceContext): string | null {
  if (candidate.resource_type === "equipment") return ctx.equipment.find((e) => e.id === candidate.resource_id)?.category ?? null;
  if (candidate.resource_type === "vehicle") return ctx.vehicles.find((v) => v.id === candidate.resource_id)?.vehicle_type ?? null;
  return null;
}

// ---- Scoring / validation / explanation ----

interface AllocationAnalysis {
  scores: AllocationScores;
  validation: AllocationValidationResult;
  explanation: ReturnType<typeof explainAllocation>;
  dependencyResults: DependencyCheckResult[];
  bundleCompleteness: BundleCompletenessResult | null;
  sharedResourceConflictCount: number;
}

async function buildAllocationCapacityChecks(workspaceId: string, request: AllocationRequest, excludeAllocationId: string | null): Promise<CapacityCheckSummary[]> {
  if (request.calendar_id === null) return [];
  const rules = (await getCoreCapacityRulesService().listRulesForWorkspace(workspaceId)).filter((r) => r.scope === "workspace");
  if (rules.length === 0) return [];

  const [allocations, requests] = await Promise.all([getCoreAllocationsService().listAllocationsForWorkspace(workspaceId), getCoreAllocationRequestsService().listRequestsForWorkspace(workspaceId)]);
  const requestById = new Map(requests.map((r) => [r.id, r] as const));
  const usageEntries: CapacityUsageEntry[] = allocations
    .filter((a) => a.status !== "archived" && a.id !== excludeAllocationId)
    .map((a) => requestById.get(a.request_id))
    .filter((r): r is AllocationRequest => r !== undefined)
    .map((r) => ({ scope: "workspace" as const, scope_id: null, starts_at: r.required_starts_at, ends_at: r.required_ends_at }));

  return rules.map((rule) => {
    const result = checkCapacity(rule, { starts_at: request.required_starts_at, ends_at: request.required_ends_at }, usageEntries);
    return { scope: rule.scope, withinCapacity: result.withinCapacity };
  });
}

async function computeSharedResourceConflictCount(workspaceId: string, request: AllocationRequest, selected: AllocationCandidate[], excludeAllocationId: string | null): Promise<number> {
  const [allocations, requests] = await Promise.all([getCoreAllocationsService().listAllocationsForWorkspace(workspaceId), getCoreAllocationRequestsService().listRequestsForWorkspace(workspaceId)]);
  const requestById = new Map(requests.map((r) => [r.id, r] as const));

  const others: ResourceUsageWindow[] = [];
  for (const allocation of allocations) {
    if (allocation.status === "archived" || allocation.id === excludeAllocationId) continue;
    const otherRequest = requestById.get(allocation.request_id);
    if (!otherRequest) continue;
    for (const candidate of allocation.candidates) {
      if (!candidate.selected) continue;
      others.push({ resource_type: candidate.resource_type, resource_id: candidate.resource_id, allocation_id: allocation.id, starts_at: otherRequest.required_starts_at, ends_at: otherRequest.required_ends_at });
    }
  }

  const selfId = excludeAllocationId ?? "__pending__";
  let count = 0;
  for (const candidate of selected) {
    const usage: ResourceUsageWindow = { resource_type: candidate.resource_type, resource_id: candidate.resource_id, allocation_id: selfId, starts_at: request.required_starts_at, ends_at: request.required_ends_at };
    count += findSharedResourceConflicts(usage, others).length;
  }
  return count;
}

async function analyzeCandidates(workspaceId: string, request: AllocationRequest, candidates: AllocationCandidate[], candidatePoolsByLineIndex: CandidatePoolEntry[][], ctx: WorkspaceResourceContext, excludeAllocationId: string | null, now: string): Promise<AllocationAnalysis> {
  const selected = candidates.filter((c) => c.selected);

  const selectedCandidateScores = selected.map((c) => {
    const pool = candidatePoolsByLineIndex[c.requirement_line_index] ?? [];
    return pool.find((e) => e.resource_id === c.resource_id)?.score ?? 0;
  });
  const totalRequiredCandidates = request.required_resources.reduce((sum, l) => sum + l.quantity, 0);

  let scheduleFitCount = selected.length;
  if (request.calendar_id !== null) {
    const calendar = await getCoreCalendarsService().getCalendarById(request.calendar_id);
    if (calendar) {
      const [workingHoursRules, calendarWindows, holidays] = await Promise.all([getCoreWorkingHoursService().listRulesForCalendar(calendar.id), getCoreCalendarWindowsService().listWindowsForWorkspace(workspaceId), getCoreHolidaysService().listHolidaysForWorkspace(workspaceId)]);
      const availability = resolveAvailabilityForInterval({ calendarId: calendar.id, workspaceId, timeZone: calendar.time_zone, starts_at: request.required_starts_at, ends_at: request.required_ends_at, workingHoursRules, calendarWindows, holidays });
      scheduleFitCount = availability.available ? selected.length : 0;
    }
  }

  const availabilityFitCount = selected.filter((c) => {
    if (c.resource_type !== "worker") return true;
    const worker = ctx.workers.find((w) => w.id === c.resource_id);
    if (!worker) return false;
    return resolveCurrentAvailability(worker, ctx.availabilityWindows, ctx.assignments, request.required_starts_at) === "available";
  }).length;

  const selectedWorkers = ctx.workers.filter((w) => selected.some((c) => c.resource_type === "worker" && c.resource_id === w.id));
  const dependencyResults: DependencyCheckResult[] = [];
  for (const candidate of selected) {
    const subjectIdentifier = resolveSubjectIdentifier(candidate, ctx);
    dependencyResults.push(...checkDependencies({ rules: ctx.dependencyRules, subjectResourceType: candidate.resource_type, subjectIdentifier, selectedWorkers, now }));
  }

  let bundleCompleteness: BundleCompletenessResult | null = null;
  if (request.bundle_id !== null) {
    const bundle = await getCoreResourceBundlesService().getBundleById(request.bundle_id);
    if (bundle) bundleCompleteness = evaluateBundleCompleteness(bundle, candidates);
  }

  const capacityChecks = await buildAllocationCapacityChecks(workspaceId, request, excludeAllocationId);
  const sharedResourceConflictCount = await computeSharedResourceConflictCount(workspaceId, request, selected, excludeAllocationId);

  const preferredMatchCount = selected.filter((c) => request.required_resources[c.requirement_line_index]?.preferred_resource_ids.includes(c.resource_id) ?? false).length;

  const scores = computeAllocationScores({ selectedCandidateScores, totalRequiredCandidates, totalSelectedCandidates: selected.length, scheduleFitCount, availabilityFitCount, bundleCompleteness, dependencyResults, capacityChecks, preferredMatchCount });
  const validation = validateAllocation({ requirementLines: request.required_resources, candidates, dependencyResults, bundleCompleteness, capacityChecks, sharedResourceConflictCount });
  const explanation = explainAllocation(candidates, scores, validation, [], bundleCompleteness);

  return { scores, validation, explanation, dependencyResults, bundleCompleteness, sharedResourceConflictCount };
}

async function syncAllocationKnowledgeGraph(workspaceId: string, createdBy: string, request: AllocationRequest, candidates: AllocationCandidate[], ctx: WorkspaceResourceContext, now: string): Promise<void> {
  const selected = candidates.filter((c) => c.selected);
  const selectedWorkers = ctx.workers.filter((w) => selected.some((c) => c.resource_type === "worker" && c.resource_id === w.id));

  for (const candidate of selected) {
    await persistRelationship(workspaceId, createdBy, buildAllocatedToRelationship({ resource_type: candidate.resource_type, resource_id: candidate.resource_id }, request.context));

    const subjectIdentifier = resolveSubjectIdentifier(candidate, ctx);
    const results = checkDependencies({ rules: ctx.dependencyRules, subjectResourceType: candidate.resource_type, subjectIdentifier, selectedWorkers, now });
    for (const result of results) {
      if (result.satisfied && result.satisfiedByResourceId) {
        await persistRelationship(workspaceId, createdBy, buildDependsOnRelationship({ resource_type: candidate.resource_type, resource_id: candidate.resource_id }, { resource_type: "worker", resource_id: result.satisfiedByResourceId }));
      }
    }
  }
  // backup_for is never persisted here — `buildAllocationProposal` never marks `is_fallback: true` on an initial proposal (see allocationEngine.ts); that signal is reserved for a future re-resolution/escalation flow this checkpoint doesn't build.
}

// ---- Proposal generation ----

interface AllocationCreationContext {
  ctx: WorkspaceResourceContext;
  usageCounts: Map<string, number>;
}

async function fetchAllocationCreationContext(workspaceId: string): Promise<AllocationCreationContext> {
  const ctx = await fetchWorkspaceResourceContext(workspaceId);
  return { ctx, usageCounts: buildResourceUsageCounts(ctx.allocations) };
}

async function createAllocationProposal(workspaceId: string, createdBy: string, request: AllocationRequest, strategy: AllocationStrategy, groupId: string, creationCtx: AllocationCreationContext, now: string): Promise<ActionResult<AllocationResult>> {
  const pools = await buildCandidatePoolsForRequest(request, creationCtx.ctx, creationCtx.usageCounts, workspaceId, createdBy);
  const proposal = buildAllocationProposal({ requirementLines: request.required_resources, candidatePoolsByLineIndex: pools, strategy });

  const created = await getCoreAllocationsService().createAllocation(workspaceId, createdBy, { request_id: request.id, group_id: groupId, strategy, candidates: proposal.candidates });
  if (!created.success) return { success: false, error: created.error };

  const analysis = await analyzeCandidates(workspaceId, request, proposal.candidates, pools, creationCtx.ctx, created.data.id, now);

  recordAllocationTimelineEvent(workspaceId, request.context, allocationCreatedEvent(strategy));
  for (const result of analysis.dependencyResults) {
    if (!result.satisfied) recordAllocationTimelineEvent(workspaceId, request.context, allocationDependencyFailedEvent(result.rule.description));
  }
  if (analysis.bundleCompleteness?.isComplete && request.bundle_id !== null) {
    const bundle = await getCoreResourceBundlesService().getBundleById(request.bundle_id);
    if (bundle) recordAllocationTimelineEvent(workspaceId, request.context, allocationBundleCompletedEvent(bundle.name));
  }
  for (const candidate of proposal.candidates) {
    if (candidate.selected && candidate.is_fallback && candidate.fallback_tier !== null) recordAllocationTimelineEvent(workspaceId, request.context, allocationFallbackUsedEvent(candidate.resource_type, candidate.fallback_tier));
  }

  await syncAllocationKnowledgeGraph(workspaceId, createdBy, request, proposal.candidates, creationCtx.ctx, now);

  return { success: true, data: { allocation: created.data, scores: analysis.scores, validation: analysis.validation, explanation: analysis.explanation } };
}

export async function generateAllocationProposalAction(requestId: string, strategy: AllocationStrategy): Promise<ActionResult<AllocationResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("allocations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const request = await getCoreAllocationRequestsService().getRequestById(requestId);
  if (!request || request.workspace_id !== workspaceId) return { success: false, error: "This allocation request could not be found." };

  const now = nowIso();
  const creationCtx = await fetchAllocationCreationContext(workspaceId);
  return createAllocationProposal(workspaceId, session.membership.id, request, strategy, generateId("allocation_group"), creationCtx, now);
}

export interface AllocationComparisonBundle {
  results: AllocationResult[];
  comparison: AllocationComparisonResult;
}

/** Generates one proposal per strategy, sharing a single `group_id` so they can be compared side by side. Each proposal is independently evaluated against the same pre-batch resource state, not against its siblings — the fair baseline for comparing alternatives rather than a sequential "first strategy claims the resource" race. */
export async function generateAllocationProposalsForComparisonAction(requestId: string, strategies: AllocationStrategy[]): Promise<ActionResult<AllocationComparisonBundle>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("allocations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (strategies.length === 0) return { success: false, error: "Select at least one allocation strategy to compare." };
  const workspaceId = session.workspace.id;

  const request = await getCoreAllocationRequestsService().getRequestById(requestId);
  if (!request || request.workspace_id !== workspaceId) return { success: false, error: "This allocation request could not be found." };

  const now = nowIso();
  const creationCtx = await fetchAllocationCreationContext(workspaceId);
  const groupId = generateId("allocation_group");

  const results: AllocationResult[] = [];
  for (const strategy of strategies) {
    const result = await createAllocationProposal(workspaceId, session.membership.id, request, strategy, groupId, creationCtx, now);
    if (!result.success) return result;
    results.push(result.data);
  }

  const comparisonInputs: ComparisonProposalInput[] = results.map((r) => ({ allocationId: r.allocation.id, strategy: r.allocation.strategy, scores: r.scores }));
  return { success: true, data: { results, comparison: compareAllocations(comparisonInputs) } };
}

// ---- Re-evaluation / comparison of existing allocations ----

async function deriveAllocationResult(workspaceId: string, memberId: string, allocation: Allocation, request: AllocationRequest, now: string): Promise<AllocationResult> {
  const ctx = await fetchWorkspaceResourceContext(workspaceId);
  const usageCounts = buildResourceUsageCounts(ctx.allocations.filter((a) => a.id !== allocation.id));
  const pools = await buildCandidatePoolsForRequest(request, ctx, usageCounts, workspaceId, memberId);
  const analysis = await analyzeCandidates(workspaceId, request, allocation.candidates, pools, ctx, allocation.id, now);
  return { allocation, scores: analysis.scores, validation: analysis.validation, explanation: analysis.explanation };
}

/** Re-derives scores/validation/explanation for an already-persisted allocation from its stable `candidates` list — never re-selects resources. The one action that emits `allocation_recalculated`; read-only views (comparison, health check) call `deriveAllocationResult` directly to avoid Timeline noise on every page load. */
export async function reEvaluateAllocationAction(allocationId: string): Promise<ActionResult<AllocationResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("allocations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const allocation = await getCoreAllocationsService().getAllocationById(allocationId);
  if (!allocation || allocation.workspace_id !== workspaceId) return { success: false, error: "This allocation could not be found." };
  const request = await getCoreAllocationRequestsService().getRequestById(allocation.request_id);
  if (!request) return { success: false, error: "This allocation's request could not be found." };

  const result = await deriveAllocationResult(workspaceId, session.membership.id, allocation, request, nowIso());
  recordAllocationTimelineEvent(workspaceId, request.context, allocationRecalculatedEvent());
  return { success: true, data: result };
}

export async function compareAllocationProposalsAction(groupId: string): Promise<ActionResult<AllocationComparisonResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const allocations = (await getCoreAllocationsService().listAllocationsForGroup(groupId)).filter((a) => a.workspace_id === workspaceId);
  if (allocations.length === 0) return { success: false, error: "This allocation group could not be found." };

  const now = nowIso();
  const inputs: ComparisonProposalInput[] = [];
  for (const allocation of allocations) {
    const request = await getCoreAllocationRequestsService().getRequestById(allocation.request_id);
    if (!request) continue;
    const result = await deriveAllocationResult(workspaceId, session.membership.id, allocation, request, now);
    inputs.push({ allocationId: allocation.id, strategy: allocation.strategy, scores: result.scores });
  }

  return { success: true, data: compareAllocations(inputs) };
}

export async function listAllocationsForRequestAction(requestId: string): Promise<ActionResult<Allocation[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const allocations = await getCoreAllocationsService().listAllocationsForRequest(requestId);
  return { success: true, data: allocations.filter((a) => a.workspace_id === session.workspace.id) };
}

export async function listAllocationGroupAction(groupId: string): Promise<ActionResult<Allocation[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const allocations = await getCoreAllocationsService().listAllocationsForGroup(groupId);
  return { success: true, data: allocations.filter((a) => a.workspace_id === session.workspace.id) };
}

export async function getAllocationAction(id: string): Promise<ActionResult<Allocation>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const allocation = await getCoreAllocationsService().getAllocationById(id);
  if (!allocation || allocation.workspace_id !== session.workspace.id) return { success: false, error: "This allocation could not be found." };
  return { success: true, data: allocation };
}

async function setAllocationStatusAction(id: string, status: "approved" | "archived"): Promise<ActionResult<Allocation>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("allocations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const result = await getCoreAllocationsService().setAllocationStatus(id, workspaceId, status, status === "approved" ? session.membership.id : null);
  if (!result.success) return { success: false, error: result.error };

  const request = await getCoreAllocationRequestsService().getRequestById(result.data.request_id);
  recordAllocationTimelineEvent(workspaceId, request?.context ?? null, status === "approved" ? allocationApprovedEvent() : allocationArchivedEvent());
  return { success: true, data: result.data };
}

export async function approveAllocationAction(id: string): Promise<ActionResult<Allocation>> {
  return setAllocationStatusAction(id, "approved");
}

export async function archiveAllocationAction(id: string): Promise<ActionResult<Allocation>> {
  return setAllocationStatusAction(id, "archived");
}

// ---- Workspace-wide evaluation (Allocation Dashboard + Executive Integration) ----

function splitResourceKey(key: string): { resourceType: ResourceType; resourceId: string } {
  const separatorIndex = key.indexOf(":");
  return { resourceType: key.slice(0, separatorIndex) as ResourceType, resourceId: key.slice(separatorIndex + 1) };
}

/** `"reserved"` is never produced here — Allocations never reserve resources (this checkpoint's own stop condition); it's reserved vocabulary for a future Dispatch checkpoint that books real `Reservation`s from an approved `Allocation`. */
function resolveResourcePoolState(resourceType: ResourceType, resourceId: string, ctx: WorkspaceResourceContext, now: string): ResourcePoolState {
  if (resourceType === "worker") {
    const worker = ctx.workers.find((w) => w.id === resourceId);
    if (!worker) return "unavailable";
    const status = resolveCurrentAvailability(worker, ctx.availabilityWindows, ctx.assignments, now);
    if (status === "available") return "available";
    if (status === "on_assignment" || status === "busy") return "busy";
    return "unavailable";
  }
  if (resourceType === "equipment") {
    const equipment = ctx.equipment.find((e) => e.id === resourceId);
    if (!equipment) return "unavailable";
    if (equipment.status === "available") return "available";
    if (equipment.status === "in_use") return "busy";
    return "unavailable";
  }
  if (resourceType === "vehicle") {
    const vehicle = ctx.vehicles.find((v) => v.id === resourceId);
    if (!vehicle) return "unavailable";
    if (vehicle.status === "available") return "available";
    if (vehicle.status === "in_use") return "busy";
    return "unavailable";
  }
  if (resourceType === "team") {
    const team = ctx.teams.find((t) => t.id === resourceId);
    return team?.status === "active" ? "available" : "unavailable";
  }
  if (resourceType === "vendor") {
    return ctx.vendors.some((v) => v.id === resourceId) ? "available" : "unavailable";
  }
  return "unavailable";
}

export interface EvaluateResourceAllocationHealthResult {
  allocations: Allocation[];
  requests: AllocationRequest[];
  findings: AllocationFinding[];
  resourcePool: ResourcePoolSnapshot;
}

/**
 * The Allocation Dashboard's data source and the one call
 * `executiveDecisionsActions.ts` makes into this domain. Re-derives
 * validation/dependency/bundle/shared-conflict state for every active
 * (non-archived) allocation — never re-selects candidates.
 */
export async function evaluateResourceAllocationHealthAction(): Promise<ActionResult<EvaluateResourceAllocationHealthResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const now = nowIso();

  const [allAllocations, requests] = await Promise.all([getCoreAllocationsService().listAllocationsForWorkspace(workspaceId), getCoreAllocationRequestsService().listRequestsForWorkspace(workspaceId)]);
  const activeAllocations = allAllocations.filter((a) => a.status !== "archived");
  const requestById = new Map(requests.map((r) => [r.id, r] as const));

  const ctx = await fetchWorkspaceResourceContext(workspaceId);

  const validationResultsByAllocationId = new Map<string, AllocationValidationResult>();
  const dependencyResultsByAllocationId = new Map<string, DependencyCheckResult[]>();
  const bundleCompletenessByAllocationId = new Map<string, BundleCompletenessResult | null>();
  const sharedResourceConflictCountByAllocationId = new Map<string, number>();
  const eligiblePoolsByLine: EligiblePoolEntry[][] = [];

  for (const allocation of activeAllocations) {
    const request = requestById.get(allocation.request_id);
    if (!request) continue;
    const usageCounts = buildResourceUsageCounts(activeAllocations.filter((a) => a.id !== allocation.id));
    const pools = await buildCandidatePoolsForRequest(request, ctx, usageCounts, workspaceId, session.membership.id);
    for (const pool of pools) eligiblePoolsByLine.push(pool.filter((e) => e.eligible).map((e) => ({ resource_type: e.resource_type, resource_id: e.resource_id })));

    const analysis = await analyzeCandidates(workspaceId, request, allocation.candidates, pools, ctx, allocation.id, now);
    validationResultsByAllocationId.set(allocation.id, analysis.validation);
    dependencyResultsByAllocationId.set(allocation.id, analysis.dependencyResults);
    bundleCompletenessByAllocationId.set(allocation.id, analysis.bundleCompleteness);
    sharedResourceConflictCountByAllocationId.set(allocation.id, analysis.sharedResourceConflictCount);
  }

  const criticalResourceKeys = detectCriticalResources(eligiblePoolsByLine);
  const findings = detectAllocationRisks({ allocations: activeAllocations, validationResultsByAllocationId, dependencyResultsByAllocationId, bundleCompletenessByAllocationId, sharedResourceConflictCountByAllocationId, criticalResourceKeys });

  const sharedResourceKeys = new Set<string>();
  const resourceStateByKey = new Map<string, ResourcePoolState>();
  for (const allocation of activeAllocations) {
    for (const candidate of allocation.candidates) {
      if (!candidate.selected) continue;
      const key = resourceKey(candidate.resource_type, candidate.resource_id);
      if (resourceStateByKey.has(key)) {
        sharedResourceKeys.add(key);
        continue;
      }
      resourceStateByKey.set(key, resolveResourcePoolState(candidate.resource_type, candidate.resource_id, ctx, now));
    }
  }
  const resourcePool = buildResourcePoolSnapshot(
    Array.from(resourceStateByKey.entries()).map(([key, state]) => {
      const { resourceType, resourceId } = splitResourceKey(key);
      return { resource_type: resourceType, resource_id: resourceId, state };
    }),
    sharedResourceKeys,
    criticalResourceKeys,
  );

  return { success: true, data: { allocations: activeAllocations, requests, findings, resourcePool } };
}

/** Adapter `executiveDecisionsActions.ts` calls directly — never re-detects, only translates `evaluateResourceAllocationHealthAction`'s findings into `OperationalRecommendation`s. */
export async function allocationRecommendationsForExecutiveDecisions() {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];
  const result = await evaluateResourceAllocationHealthAction();
  if (!result.success) return [];
  return allocationFindingsToRecommendations(result.data.findings, result.data.requests, result.data.allocations, session.workspace.id);
}
