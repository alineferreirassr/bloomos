"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCoreCapabilityRequirementsService, type CreateCapabilityRequirementInput, type UpdateCapabilityRequirementInput, type CapabilityRequirementFilters } from "@/core/capability";
import { getCoreWorkersService, getCoreTeamsService, getCoreAvailabilityService, getCoreAssignmentsService, getCoreEquipmentService, getCoreVehiclesService, getCoreLocationService } from "@/core/workforce";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { resolveCurrentAvailability } from "@/core/workforce/availabilityEngine";
import { evaluateEligibility, type EligibilityContext } from "@/core/capability/eligibilityEngine";
import { computeCapabilityScores } from "@/core/capability/capabilityScoreEngine";
import { explainCapabilityEvaluation, type CapabilityExplanation } from "@/core/capability/capabilityExplanationEngine";
import { rankWorkers } from "@/core/capability/workerRankingEngine";
import { computeCapabilityCoverage } from "@/core/capability/capabilityCoverageEngine";
import { detectWorkforceRisks } from "@/core/capability/capabilityRiskEngine";
import { detectWorkerAssignmentConflict } from "@/core/capability/assignmentConflictEngine";
import { requirementCreatedEvent, requirementUpdatedEvent, requirementArchivedEvent, stateTransitionEvent, scoreChangedEvent, blockerDetectedEvent } from "@/core/capability/capabilityTimelineEngine";
import { getEvaluationSnapshot, setEvaluationSnapshot } from "@/lib/data/mock/capabilityEvaluationSnapshotsStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { nowIso } from "@/lib/data/utils";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import type { CapabilityRequirement, RequirementEvaluationResult, WorkerRankingEntry, CapabilityCoverageReport, WorkforceRisk } from "@/types/capability";
import type { Worker, Team, Equipment, Vehicle } from "@/types/workforce";

const GENERIC_ACCESS_ERROR = "The Workforce Capability Platform isn't available. You may not have access to it.";
const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);
const DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS = 30;
const ELIGIBILITY_RELATIONSHIP_TYPES = new Set(["eligible_for", "conditionally_eligible_for", "ineligible_for"]);

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function workerFullName(worker: Pick<Worker, "first_name" | "last_name">): string {
  return `${worker.first_name} ${worker.last_name}`;
}

export async function createCapabilityRequirementAction(input: CreateCapabilityRequirementInput): Promise<ActionResult<CapabilityRequirement>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.capabilities.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreCapabilityRequirementsService().createRequirement(session.workspace.id, session.membership.id, input);
  if (!result.success) return { success: false, error: result.error };

  const event = requirementCreatedEvent(result.data.title);
  const ownerType = result.data.context?.nodeType ?? "workspace";
  const ownerId = result.data.context?.nodeId ?? session.workspace.id;
  if (ENTITY_TYPE_SET.has(ownerType)) recordTimelineActivity(session.workspace.id, ownerType as EntityType, ownerId, event.type, event.description);

  return { success: true, data: result.data };
}

export async function listCapabilityRequirementsAction(filters: CapabilityRequirementFilters = {}): Promise<ActionResult<CapabilityRequirement[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const requirements = await getCoreCapabilityRequirementsService().listRequirementsForWorkspace(session.workspace.id, filters);
  return { success: true, data: requirements };
}

export async function getCapabilityRequirementAction(id: string): Promise<ActionResult<CapabilityRequirement>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const requirement = await getCoreCapabilityRequirementsService().getRequirementById(id);
  if (!requirement || requirement.workspace_id !== session.workspace.id) return { success: false, error: "This capability requirement could not be found." };
  return { success: true, data: requirement };
}

export async function updateCapabilityRequirementAction(id: string, input: UpdateCapabilityRequirementInput): Promise<ActionResult<CapabilityRequirement>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.capabilities.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreCapabilityRequirementsService().updateRequirement(id, session.workspace.id, input);
  if (!result.success) return { success: false, error: result.error };

  const event = requirementUpdatedEvent(result.data.title);
  const ownerType = result.data.context?.nodeType ?? "workspace";
  const ownerId = result.data.context?.nodeId ?? session.workspace.id;
  if (ENTITY_TYPE_SET.has(ownerType)) recordTimelineActivity(session.workspace.id, ownerType as EntityType, ownerId, event.type, event.description);

  return { success: true, data: result.data };
}

export async function archiveCapabilityRequirementAction(id: string): Promise<ActionResult<CapabilityRequirement>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.capabilities.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreCapabilityRequirementsService().archiveRequirement(id, session.workspace.id);
  if (!result.success) return { success: false, error: result.error };

  const event = requirementArchivedEvent(result.data.title);
  const ownerType = result.data.context?.nodeType ?? "workspace";
  const ownerId = result.data.context?.nodeId ?? session.workspace.id;
  if (ENTITY_TYPE_SET.has(ownerType)) recordTimelineActivity(session.workspace.id, ownerType as EntityType, ownerId, event.type, event.description);

  return { success: true, data: result.data };
}

export async function duplicateCapabilityRequirementAction(id: string): Promise<ActionResult<CapabilityRequirement>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.capabilities.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreCapabilityRequirementsService().duplicateRequirement(id, session.workspace.id, session.membership.id);
  if (!result.success) return { success: false, error: result.error };

  const event = requirementCreatedEvent(result.data.title);
  const ownerType = result.data.context?.nodeType ?? "workspace";
  const ownerId = result.data.context?.nodeId ?? session.workspace.id;
  if (ENTITY_TYPE_SET.has(ownerType)) recordTimelineActivity(session.workspace.id, ownerType as EntityType, ownerId, event.type, event.description);

  return { success: true, data: result.data };
}

interface WorkforceDataset {
  workers: Worker[];
  teams: Team[];
  equipment: Equipment[];
  vehicles: Vehicle[];
  workspaceId: string;
}

async function fetchWorkforceDataset(workspaceId: string): Promise<WorkforceDataset> {
  const [workers, teams, equipment, vehicles] = await Promise.all([
    getCoreWorkersService().listWorkersForWorkspace(workspaceId, false),
    getCoreTeamsService().listTeamsForWorkspace(workspaceId, false),
    getCoreEquipmentService().listEquipmentForWorkspace(workspaceId, false),
    getCoreVehiclesService().listVehiclesForWorkspace(workspaceId, false),
  ]);
  return { workers, teams, equipment, vehicles, workspaceId };
}

async function buildEligibilityContextForWorker(worker: Worker, dataset: WorkforceDataset, now: string): Promise<EligibilityContext> {
  const [windows, allAssignments] = await Promise.all([getCoreAvailabilityService().listWindowsForWorker(worker.id), getCoreAssignmentsService().listAssignmentsForWorkspace(dataset.workspaceId)]);
  const activeAssignments = allAssignments.filter((a) => a.status === "active");
  const currentAvailability = resolveCurrentAvailability(worker, windows, activeAssignments, now);

  const workerTeam = worker.team_id ? (dataset.teams.find((t) => t.id === worker.team_id) ?? null) : null;
  const teamMemberIds = new Set(workerTeam?.member_worker_ids ?? []);

  const workerEquipment = dataset.equipment.filter((e) => e.assigned_worker_id === worker.id);
  const teamEquipment = dataset.equipment.filter((e) => e.assigned_worker_id !== null && e.assigned_worker_id !== worker.id && teamMemberIds.has(e.assigned_worker_id));
  const workerVehicle = dataset.vehicles.find((v) => v.assigned_worker_id === worker.id) ?? null;
  const teamVehicles = dataset.vehicles.filter((v) => v.assigned_worker_id !== null && v.assigned_worker_id !== worker.id && teamMemberIds.has(v.assigned_worker_id));

  const location = await getCoreLocationService().getLatestSnapshot(worker.id);

  return {
    worker,
    currentAvailability,
    allActiveAssignments: activeAssignments,
    workerEquipment,
    teamEquipment,
    workerVehicle,
    teamVehicles,
    workerLocation: location,
    now,
    expiringSoonThresholdDays: DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS,
  };
}

/**
 * Syncs the worker's `eligible_for`/`conditionally_eligible_for`/
 * `ineligible_for` Knowledge Graph edge to match the freshly-computed
 * state — archives the prior state edge (if different) rather than
 * letting stale edges accumulate, and always ensures one `evaluated_for`
 * edge exists (idempotent via the store's own exact-duplicate dedup).
 * Only runs when the requirement has a real `context` node — per the
 * stop condition, never a fabricated one.
 */
async function syncEligibilityRelationship(workspaceId: string, createdBy: string, workerId: string, contextNodeType: string, contextNodeId: string, state: WorkerRankingEntry["eligibility"]["state"]): Promise<void> {
  const stateRelationshipType = state === "eligible" ? "eligible_for" : state === "ineligible" ? "ineligible_for" : state === "conditionally_eligible" ? "conditionally_eligible_for" : null;

  const existingOutbound = await getCoreKnowledgeGraphService().getOutboundRelationships(workspaceId, { nodeType: "worker", nodeId: workerId }, false);
  const existingStateEdges = existingOutbound.filter((r) => r.target_node_type === contextNodeType && r.target_node_id === contextNodeId && ELIGIBILITY_RELATIONSHIP_TYPES.has(r.relationship_type));

  for (const edge of existingStateEdges) {
    if (edge.relationship_type !== stateRelationshipType) await getCoreKnowledgeGraphService().removeRelationship(edge.id, workspaceId);
  }

  if (stateRelationshipType && !existingStateEdges.some((e) => e.relationship_type === stateRelationshipType)) {
    await getCoreKnowledgeGraphService().createRelationship(workspaceId, createdBy, {
      sourceNodeType: "worker",
      sourceNodeId: workerId,
      targetNodeType: contextNodeType as never,
      targetNodeId: contextNodeId,
      relationshipType: stateRelationshipType,
      source: "user_action",
    });
  }

  await getCoreKnowledgeGraphService().createRelationship(workspaceId, createdBy, {
    sourceNodeType: "worker",
    sourceNodeId: workerId,
    targetNodeType: contextNodeType as never,
    targetNodeId: contextNodeId,
    relationshipType: "evaluated_for",
    source: "user_action",
  });
}

/**
 * Shared evaluation logic — no session resolution or permission check of
 * its own. `evaluateCapabilityRequirementAction` (a direct, manual
 * re-evaluation trigger) gates this behind `workforce.capabilities.manage`;
 * `evaluateWorkforceCapabilityCoverageAction` (the read-oriented Coverage
 * Dashboard, gated behind the narrower `.view`) calls this directly so a
 * view-only member still gets a populated coverage/risk report instead of
 * every nested evaluation silently failing permission checks. Exported for
 * the same reason cross-module callers (e.g. `allocationActions.ts`'s
 * worker-pool builder) need it — internal orchestration should never be
 * blocked by a permission scoped to the *manual* evaluation trigger.
 */
export async function runCapabilityEvaluation(requirementId: string, workspaceId: string, memberId: string): Promise<ActionResult<RequirementEvaluationResult>> {
  const now = nowIso();

  const requirement = await getCoreCapabilityRequirementsService().getRequirementById(requirementId);
  if (!requirement || requirement.workspace_id !== workspaceId) return { success: false, error: "This capability requirement could not be found." };

  const dataset = await fetchWorkforceDataset(workspaceId);
  const activeWorkers = dataset.workers.filter((w) => !requirement.excluded_worker_ids.includes(w.id));

  const evaluations: { eligibility: ReturnType<typeof evaluateEligibility>; scores: ReturnType<typeof computeCapabilityScores>; explanation: CapabilityExplanation }[] = [];

  for (const worker of activeWorkers) {
    const context = await buildEligibilityContextForWorker(worker, dataset, now);
    const eligibility = evaluateEligibility(requirement, context);
    const conflict = detectWorkerAssignmentConflict(worker.id, requirement.context_type, requirement.context?.nodeId ?? "", context.allActiveAssignments);
    const scores = computeCapabilityScores({
      requirement,
      worker,
      eligibility,
      currentAvailability: context.currentAvailability,
      workerEquipment: context.workerEquipment,
      teamEquipment: context.teamEquipment,
      workerVehicle: context.workerVehicle,
      teamVehicles: context.teamVehicles,
      workerLocation: context.workerLocation,
      workerActiveAssignmentCount: conflict.workerActiveAssignmentCount,
      now,
    });
    const explanation = explainCapabilityEvaluation(eligibility, scores);
    evaluations.push({ eligibility, scores, explanation });

    // Timeline — only on a real transition or a meaningful score change, never on every evaluation unconditionally.
    const priorSnapshot = getEvaluationSnapshot(requirement.id, worker.id);
    const workerName = workerFullName(worker);
    if (priorSnapshot === null || priorSnapshot.state !== eligibility.state) {
      const event = stateTransitionEvent(workerName, requirement.title, priorSnapshot?.state ?? null, eligibility.state);
      recordTimelineActivity(workspaceId, "worker", worker.id, event.type, event.description);
      if (eligibility.state === "ineligible" && eligibility.blockingReasons.length > 0) {
        const blockerEvent = blockerDetectedEvent(workerName, requirement.title, eligibility.blockingReasons[0].detail);
        recordTimelineActivity(workspaceId, "worker", worker.id, blockerEvent.type, blockerEvent.description);
      }
    } else if (Math.abs(priorSnapshot.overallCapabilityScore - scores.overallCapabilityScore) >= 10) {
      const event = scoreChangedEvent(workerName, requirement.title, priorSnapshot.overallCapabilityScore, scores.overallCapabilityScore);
      recordTimelineActivity(workspaceId, "worker", worker.id, event.type, event.description);
    }
    setEvaluationSnapshot({ requirementId: requirement.id, workerId: worker.id, state: eligibility.state, overallCapabilityScore: scores.overallCapabilityScore });

    // Knowledge Graph — persistent relationships for this saved requirement, only when it has a real context node.
    if (requirement.context !== null) {
      await syncEligibilityRelationship(workspaceId, memberId, worker.id, requirement.context.nodeType, requirement.context.nodeId, eligibility.state);
    }
  }

  const ranking = rankWorkers(evaluations.map((e) => ({ eligibility: e.eligibility, scores: e.scores })));
  const eligibleCount = ranking.filter((r) => r.eligibility.state === "eligible").length;
  const conditionallyEligibleCount = ranking.filter((r) => r.eligibility.state === "conditionally_eligible").length;
  const ineligibleCount = ranking.filter((r) => r.eligibility.state === "ineligible" || r.eligibility.state === "unknown").length;

  return { success: true, data: { requirement, ranking, eligibleCount, conditionallyEligibleCount, ineligibleCount, evaluatedAt: now } };
}

export async function evaluateCapabilityRequirementAction(requirementId: string): Promise<ActionResult<RequirementEvaluationResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.capabilities.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  return runCapabilityEvaluation(requirementId, session.workspace.id, session.membership.id);
}

export interface EvaluateWorkforceCapabilityCoverageResult {
  coverage: CapabilityCoverageReport;
  risks: WorkforceRisk[];
  evaluationResults: RequirementEvaluationResult[];
}

/** v2.0 Checkpoint 26.1, Step 19-20 orchestrator — evaluates every active requirement, then rolls the results into workspace-level coverage and risk reports. */
export async function evaluateWorkforceCapabilityCoverageAction(): Promise<ActionResult<EvaluateWorkforceCapabilityCoverageResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const now = nowIso();

  const requirements = await getCoreCapabilityRequirementsService().listRequirementsForWorkspace(workspaceId, {});
  const evaluationResults: RequirementEvaluationResult[] = [];
  for (const requirement of requirements) {
    const result = await runCapabilityEvaluation(requirement.id, workspaceId, session.membership.id);
    if (result.success) evaluationResults.push(result.data);
  }

  const dataset = await fetchWorkforceDataset(workspaceId);
  const activeWorkers = dataset.workers.filter((w) => w.status === "active");
  const windowsByWorker = await Promise.all(activeWorkers.map((w) => getCoreAvailabilityService().listWindowsForWorker(w.id)));
  const allAssignments = (await getCoreAssignmentsService().listAssignmentsForWorkspace(workspaceId)).filter((a) => a.status === "active");
  const availableWorkerCount = activeWorkers.filter((w, i) => resolveCurrentAvailability(w, windowsByWorker[i], allAssignments, now) === "available").length;
  const activeTeams = dataset.teams.filter((t) => t.status === "active");

  const coverage = computeCapabilityCoverage({ workspaceId, activeWorkers, availableWorkerCount, activeTeams, equipment: dataset.equipment, vehicles: dataset.vehicles, evaluationResults, now });
  const risks = detectWorkforceRisks({ evaluationResults, activeWorkers, equipment: dataset.equipment, vehicles: dataset.vehicles, activeTeams, now });

  return { success: true, data: { coverage, risks, evaluationResults } };
}

export interface WorkerCapabilitySummary {
  worker: Worker;
  eligibleRequirements: { requirement: CapabilityRequirement; entry: WorkerRankingEntry }[];
  conditionallyEligibleRequirements: { requirement: CapabilityRequirement; entry: WorkerRankingEntry }[];
  ineligibleRequirements: { requirement: CapabilityRequirement; entry: WorkerRankingEntry }[];
  relatedRisks: WorkforceRisk[];
}

/** v2.0 Checkpoint 26.1, Step 23 — Worker Capability View's data source. Reuses `evaluateWorkforceCapabilityCoverageAction`'s already-computed results, filtered down to one worker — never a second evaluation pass. */
export async function evaluateWorkerCapabilityAction(workerId: string): Promise<ActionResult<WorkerCapabilitySummary>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const worker = await getCoreWorkersService().getWorkerById(workerId);
  if (!worker || worker.workspace_id !== session.workspace.id) return { success: false, error: "This worker could not be found." };

  const coverageResult = await evaluateWorkforceCapabilityCoverageAction();
  if (!coverageResult.success) return { success: false, error: coverageResult.error };

  const eligibleRequirements: WorkerCapabilitySummary["eligibleRequirements"] = [];
  const conditionallyEligibleRequirements: WorkerCapabilitySummary["conditionallyEligibleRequirements"] = [];
  const ineligibleRequirements: WorkerCapabilitySummary["ineligibleRequirements"] = [];

  for (const result of coverageResult.data.evaluationResults) {
    const entry = result.ranking.find((r) => r.workerId === workerId);
    if (!entry) continue;
    if (entry.eligibility.state === "eligible") eligibleRequirements.push({ requirement: result.requirement, entry });
    else if (entry.eligibility.state === "conditionally_eligible") conditionallyEligibleRequirements.push({ requirement: result.requirement, entry });
    else ineligibleRequirements.push({ requirement: result.requirement, entry });
  }

  const relatedRisks = coverageResult.data.risks.filter((r) => r.relatedWorkerId === workerId);

  return { success: true, data: { worker, eligibleRequirements, conditionallyEligibleRequirements, ineligibleRequirements, relatedRisks } };
}
