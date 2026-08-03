"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCoreFieldOperationsService, type CreateFieldOperationInput } from "@/core/fieldOperations";
import { getCoreDispatchOrdersService } from "@/core/dispatch";
import { getCoreExecutionPackagesService } from "@/core/executionPackage";
import { evaluateFieldOperationEligibility } from "@/core/fieldOperations/fieldOperationEngine";
import { validateExecution } from "@/core/fieldOperations/executionValidationEngine";
import { computeOperationalProgress } from "@/core/fieldOperations/operationalProgressEngine";
import { computeExecutionState } from "@/core/fieldOperations/executionStateEngine";
import { computeExecutionHealthScores } from "@/core/fieldOperations/executionHealthEngine";
import { explainExecution } from "@/core/fieldOperations/executionExplanationEngine";
import {
  evaluateStartDecision,
  evaluatePauseDecision,
  evaluateResumeDecision,
  evaluateCompleteDecision,
  evaluateCancelDecision,
  evaluateAbortDecision,
  evaluateFailDecision,
  evaluateArchiveDecision,
} from "@/core/fieldOperations/executionSessionEngine";
import { executionStartedEvent, executionPausedEvent, executionResumedEvent, executionCompletedEvent, executionCancelledEvent, executionFailedEvent, executionArchivedEvent } from "@/core/fieldOperations/executionTimelineEngine";
import { detectFieldOperationRisks, type FieldOperationRiskInput } from "@/core/fieldOperations/fieldOperationRiskEngine";
import { fieldOperationFindingsToRecommendations } from "@/core/fieldOperations/fieldOperationFindingsEngine";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { nowIso } from "@/lib/data/utils";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { ExecutionPhase } from "@/types/operationalPlanning";
import type { FieldOperation, ExecutionSession, ExecutionResult, ExecutionValidationInput, FieldOperationFinding } from "@/types/fieldOperations";

/**
 * v2.0 Checkpoint 29 — Field Operations Platform module layer. Dispatch
 * (28) assigns work; this file manages and tracks its EXECUTION STATE
 * ONLY — no GPS, no route optimization, no live monitoring, no AI, no
 * recalculation of Dispatch/Allocation/Scheduling, no rebuilding of
 * Execution Packages. Every action resolves the same real Dispatch
 * Order/Assignment/Execution Package/frozen snapshot a `FieldOperation`
 * was built from — never a second, duplicate resolution of any of it.
 */

const GENERIC_ACCESS_ERROR = "Field Operations aren't available. You may not have access to them.";
const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function recordFieldOperationTimelineEvent(workspaceId: string, node: KnowledgeNodeRef | null, event: { type: TimelineActivityType; description: string }): void {
  const ownerType = node?.nodeType ?? "workspace";
  const ownerId = node?.nodeId ?? workspaceId;
  if (!ENTITY_TYPE_SET.has(ownerType)) return;
  recordTimelineActivity(workspaceId, ownerType as EntityType, ownerId, event.type, event.description);
}

async function fetchOperationOrFail(id: string, workspaceId: string): Promise<{ operation: FieldOperation } | { error: string }> {
  const operation = await getCoreFieldOperationsService().getOperationById(id);
  if (!operation || operation.workspace_id !== workspaceId) return { error: "This field operation could not be found." };
  return { operation };
}

/** The most recent session — the one active/being-restarted session a `FieldOperation` is ever evaluated against; earlier sessions stay in the log, frozen, once a fresh one is appended by `startNewSession`. */
function currentSessionOf(operation: FieldOperation): ExecutionSession {
  return operation.sessions[operation.sessions.length - 1];
}

function sumEstimatedDurationSeconds(phases: ExecutionPhase[]): number {
  return phases.flatMap((p) => p.steps).reduce((total, step) => total + step.estimated_duration_minutes * 60, 0);
}

interface EvaluationContext {
  operation: FieldOperation;
  session: ExecutionSession;
  phases: ExecutionPhase[];
  validationInput: ExecutionValidationInput;
}

/** Resolves the real Dispatch Order/Assignment/Execution Package a `FieldOperation` was built from, and derives `ExecutionValidationEngine`'s own input facts from their current live state — never a re-derivation of Dispatch/Allocation/Scheduling's own decisions, only a read of what they already decided. */
async function resolveEvaluationContext(operation: FieldOperation): Promise<EvaluationContext | { error: string }> {
  const order = await getCoreDispatchOrdersService().getOrderById(operation.dispatch_order_id);
  if (!order) return { error: "The source dispatch order could not be found." };
  const assignment = order.assignments.find((a) => a.id === operation.dispatch_assignment_id);
  if (!assignment) return { error: "The source dispatch assignment could not be found." };

  const pkg = await getCoreExecutionPackagesService().getPackageById(operation.execution_package_id);
  if (!pkg) return { error: "The source execution package could not be found." };
  const version = pkg.versions.find((v) => v.id === operation.execution_version_id);
  if (!version) return { error: "The source execution version could not be found." };

  const validationInput: ExecutionValidationInput = {
    dispatchAccepted: assignment.queue_state === "accepted",
    packageApproved: pkg.status === "approved",
    workerAssigned: order.assignments.some((a) => a.resource_type === "worker"),
    requiredResourcesPresent: order.assignments.length > 0,
    operationalPlanExists: version.snapshot.operational_plan_id !== null,
    assignmentActive: order.status === "dispatched" && assignment.queue_state === "accepted",
  };

  return { operation, session: currentSessionOf(operation), phases: version.snapshot.phases, validationInput };
}

export interface BuildFieldOperationInput {
  dispatchOrderId: string;
  dispatchAssignmentId: string;
}

export async function buildFieldOperationAction(input: BuildFieldOperationInput): Promise<ActionResult<FieldOperation>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("field_operations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const order = await getCoreDispatchOrdersService().getOrderById(input.dispatchOrderId);
  if (!order || order.workspace_id !== workspaceId) return { success: false, error: "This dispatch order could not be found." };
  const assignment = order.assignments.find((a) => a.id === input.dispatchAssignmentId);
  if (!assignment) return { success: false, error: "This dispatch assignment could not be found." };
  const pkg = await getCoreExecutionPackagesService().getPackageById(order.execution_package_id);
  if (!pkg) return { success: false, error: "The source execution package could not be found." };

  const eligibility = evaluateFieldOperationEligibility({ assignmentQueueState: assignment.queue_state, packageStatus: pkg.status });
  if (!eligibility.canBuild) return { success: false, error: eligibility.reason ?? "This field operation cannot be built." };

  const input_: CreateFieldOperationInput = {
    dispatch_order_id: order.id,
    dispatch_assignment_id: assignment.id,
    execution_package_id: pkg.id,
    execution_version_id: order.execution_version_id,
    priority: order.priority,
    context: pkg.context.context,
  };
  const result = await getCoreFieldOperationsService().createOperation(workspaceId, session.membership.id, input_);
  if (!result.success) return { success: false, error: result.error };

  // No Timeline event on creation — the spec's own 7 named events (Step 9) begin at "Execution Started," never at build time.
  return { success: true, data: result.data };
}

export async function listFieldOperationsAction(includeArchived = false): Promise<ActionResult<FieldOperation[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const operations = await getCoreFieldOperationsService().listOperationsForWorkspace(session.workspace.id, includeArchived);
  return { success: true, data: operations };
}

export async function getFieldOperationAction(id: string): Promise<ActionResult<FieldOperation>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchOperationOrFail(id, session.workspace.id);
  if ("error" in found) return { success: false, error: found.error };
  return { success: true, data: found.operation };
}

async function evaluateOperation(operation: FieldOperation): Promise<ExecutionResult | { error: string }> {
  const context = await resolveEvaluationContext(operation);
  if ("error" in context) return context;

  const validation = validateExecution(context.validationInput);
  const state = computeExecutionState(context.session, nowIso());
  const pkg = await getCoreExecutionPackagesService().getPackageById(operation.execution_package_id);
  const version = pkg?.versions.find((v) => v.id === operation.execution_version_id);
  const snapshot = version?.snapshot;

  const progress = computeOperationalProgress({
    phases: snapshot?.phases ?? [],
    milestones: snapshot?.milestones ?? [],
    deliverables: snapshot?.deliverables ?? [],
    checklists: snapshot?.checklists ?? [],
    session: context.session,
  });
  const health = computeExecutionHealthScores({ validation, state, progress, outcome: context.session.outcome, lifecycleState: context.session.lifecycle_state });
  const explanation = explainExecution(validation, health, context.session, progress);

  return { fieldOperation: operation, session: context.session, validation, state, health, explanation, progress };
}

export async function evaluateFieldOperationAction(id: string): Promise<ActionResult<ExecutionResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchOperationOrFail(id, session.workspace.id);
  if ("error" in found) return { success: false, error: found.error };
  const result = await evaluateOperation(found.operation);
  if ("error" in result) return { success: false, error: result.error };
  return { success: true, data: result };
}

async function transition(operationId: string, decision: { allowed: boolean; nextState: ExecutionSession["lifecycle_state"] | null; error: string | null }, reason: string | null, event: { type: TimelineActivityType; description: string } | null): Promise<ActionResult<FieldOperation>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("field_operations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchOperationOrFail(operationId, workspaceId);
  if ("error" in found) return { success: false, error: found.error };
  if (!decision.allowed || decision.nextState === null) return { success: false, error: decision.error ?? "This transition is not allowed." };

  const currentSession = currentSessionOf(found.operation);
  const result = await getCoreFieldOperationsService().transitionSession(operationId, workspaceId, currentSession.id, decision.nextState, reason);
  if (!result.success) return { success: false, error: result.error };

  if (event) recordFieldOperationTimelineEvent(workspaceId, found.operation.context, event);
  return { success: true, data: result.data };
}

export async function startSessionAction(operationId: string): Promise<ActionResult<FieldOperation>> {
  const memberSession = await resolveMemberSessionSnapshot();
  if (memberSession.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchOperationOrFail(operationId, memberSession.workspace.id);
  if ("error" in found) return { success: false, error: found.error };
  const context = await resolveEvaluationContext(found.operation);
  if ("error" in context) return { success: false, error: context.error };

  const validation = validateExecution(context.validationInput);
  const decision = evaluateStartDecision(context.session, validation);
  return transition(operationId, decision, null, decision.allowed ? executionStartedEvent() : null);
}

export async function pauseSessionAction(operationId: string, reason: string | null = null): Promise<ActionResult<FieldOperation>> {
  const memberSession = await resolveMemberSessionSnapshot();
  if (memberSession.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchOperationOrFail(operationId, memberSession.workspace.id);
  if ("error" in found) return { success: false, error: found.error };
  const decision = evaluatePauseDecision(currentSessionOf(found.operation));
  return transition(operationId, decision, reason, decision.allowed ? executionPausedEvent(reason) : null);
}

export async function resumeSessionAction(operationId: string): Promise<ActionResult<FieldOperation>> {
  const memberSession = await resolveMemberSessionSnapshot();
  if (memberSession.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchOperationOrFail(operationId, memberSession.workspace.id);
  if ("error" in found) return { success: false, error: found.error };
  const decision = evaluateResumeDecision(currentSessionOf(found.operation));
  return transition(operationId, decision, null, decision.allowed ? executionResumedEvent() : null);
}

export async function completeSessionAction(operationId: string): Promise<ActionResult<FieldOperation>> {
  const memberSession = await resolveMemberSessionSnapshot();
  if (memberSession.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchOperationOrFail(operationId, memberSession.workspace.id);
  if ("error" in found) return { success: false, error: found.error };

  const result = await evaluateOperation(found.operation);
  if ("error" in result) return { success: false, error: result.error };
  const requiredWorkComplete = result.progress.remainingStepIds.length === 0 && result.progress.pendingMilestoneIds.length === 0 && result.progress.checklistProgress === 100 && result.progress.deliverableProgress === 100;

  const decision = evaluateCompleteDecision(currentSessionOf(found.operation), requiredWorkComplete);
  const transitioned = await transition(operationId, decision, null, decision.allowed ? executionCompletedEvent() : null);
  if (!transitioned.success) return transitioned;

  const statusResult = await getCoreFieldOperationsService().setOperationStatus(operationId, memberSession.workspace.id, "completed");
  if (!statusResult.success) return { success: false, error: statusResult.error };
  return { success: true, data: statusResult.data };
}

export async function cancelSessionAction(operationId: string, reason: string): Promise<ActionResult<FieldOperation>> {
  const memberSession = await resolveMemberSessionSnapshot();
  if (memberSession.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchOperationOrFail(operationId, memberSession.workspace.id);
  if ("error" in found) return { success: false, error: found.error };

  const decision = evaluateCancelDecision(currentSessionOf(found.operation), reason);
  const transitioned = await transition(operationId, decision, reason, decision.allowed ? executionCancelledEvent(reason) : null);
  if (!transitioned.success) return transitioned;

  const statusResult = await getCoreFieldOperationsService().setOperationStatus(operationId, memberSession.workspace.id, "cancelled");
  if (!statusResult.success) return { success: false, error: statusResult.error };
  return { success: true, data: statusResult.data };
}

/** Abort has no Timeline event of its own in the spec's own named list (Step 9) — it emits the same `execution_failed` event `failSessionAction` does, since both represent a non-graceful stop of already-active work. The two remain distinct in the domain data itself (`ExecutionSession.outcome` is `"aborted"` vs `"failed"`) — only the shared Timeline entry looks the same. */
export async function abortSessionAction(operationId: string, reason: string): Promise<ActionResult<FieldOperation>> {
  const memberSession = await resolveMemberSessionSnapshot();
  if (memberSession.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchOperationOrFail(operationId, memberSession.workspace.id);
  if ("error" in found) return { success: false, error: found.error };
  const decision = evaluateAbortDecision(currentSessionOf(found.operation), reason);
  return transition(operationId, decision, reason, decision.allowed ? executionFailedEvent(reason) : null);
}

export async function failSessionAction(operationId: string, reason: string): Promise<ActionResult<FieldOperation>> {
  const memberSession = await resolveMemberSessionSnapshot();
  if (memberSession.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchOperationOrFail(operationId, memberSession.workspace.id);
  if ("error" in found) return { success: false, error: found.error };
  const decision = evaluateFailDecision(currentSessionOf(found.operation), reason);
  return transition(operationId, decision, reason, decision.allowed ? executionFailedEvent(reason) : null);
}

/** Archiving the current session also files the whole `FieldOperation` away — the natural end of the line once its most recent session has a recorded outcome and is put away. */
export async function archiveSessionAction(operationId: string): Promise<ActionResult<FieldOperation>> {
  const memberSession = await resolveMemberSessionSnapshot();
  if (memberSession.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchOperationOrFail(operationId, memberSession.workspace.id);
  if ("error" in found) return { success: false, error: found.error };

  const decision = evaluateArchiveDecision(currentSessionOf(found.operation));
  const transitioned = await transition(operationId, decision, null, decision.allowed ? executionArchivedEvent() : null);
  if (!transitioned.success) return transitioned;

  const statusResult = await getCoreFieldOperationsService().setOperationStatus(operationId, memberSession.workspace.id, "archived");
  if (!statusResult.success) return { success: false, error: statusResult.error };
  return { success: true, data: statusResult.data };
}

/** Restarts work on a `FieldOperation` after a prior session ended in `cancelled`/`aborted`/`failed` — appends a fresh session, never mutating history. */
export async function restartFieldOperationAction(operationId: string): Promise<ActionResult<FieldOperation>> {
  const memberSession = await resolveMemberSessionSnapshot();
  if (memberSession.kind !== "active" || !memberSession.permissions.includes("field_operations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchOperationOrFail(operationId, memberSession.workspace.id);
  if ("error" in found) return { success: false, error: found.error };

  const currentSession = currentSessionOf(found.operation);
  if (currentSession.lifecycle_state !== "cancelled" && currentSession.lifecycle_state !== "aborted" && currentSession.lifecycle_state !== "failed") {
    return { success: false, error: "Only a cancelled, aborted, or failed session can be restarted." };
  }
  const result = await getCoreFieldOperationsService().startNewSession(operationId, memberSession.workspace.id);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export interface UpdateSessionProgressInput {
  current_phase_id?: string | null;
  completed_step_ids?: string[];
  completed_milestone_ids?: string[];
  completed_checklist_item_ids?: string[];
  completed_deliverable_ids?: string[];
}

/** Records live execution-progress overlay changes — a session can make progress while `started`/`resumed` without changing its own `lifecycle_state`. No Timeline event: progress changes aren't among the spec's own 7 named events (Step 9), only lifecycle transitions are. */
export async function updateSessionProgressAction(operationId: string, progress: UpdateSessionProgressInput): Promise<ActionResult<FieldOperation>> {
  const memberSession = await resolveMemberSessionSnapshot();
  if (memberSession.kind !== "active" || !memberSession.permissions.includes("field_operations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchOperationOrFail(operationId, memberSession.workspace.id);
  if ("error" in found) return { success: false, error: found.error };

  const currentSession = currentSessionOf(found.operation);
  const result = await getCoreFieldOperationsService().updateSessionProgress(operationId, memberSession.workspace.id, currentSession.id, progress);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export interface EvaluateFieldOperationsPlatformHealthResult {
  results: ExecutionResult[];
  findings: FieldOperationFinding[];
}

export async function evaluateFieldOperationsPlatformHealthAction(): Promise<ActionResult<EvaluateFieldOperationsPlatformHealthResult>> {
  const memberSession = await resolveMemberSessionSnapshot();
  if (memberSession.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const operations = await getCoreFieldOperationsService().listOperationsForWorkspace(memberSession.workspace.id, false);

  const results: ExecutionResult[] = [];
  const riskInputs: FieldOperationRiskInput[] = [];
  for (const operation of operations) {
    const result = await evaluateOperation(operation);
    if ("error" in result) continue;
    results.push(result);

    const context = await resolveEvaluationContext(operation);
    const estimatedDurationSeconds = "error" in context ? 0 : sumEstimatedDurationSeconds(context.phases);
    riskInputs.push({ fieldOperationId: operation.id, session: result.session, validation: result.validation, health: result.health, state: result.state, estimatedDurationSeconds });
  }

  const findings = detectFieldOperationRisks(riskInputs);
  return { success: true, data: { results, findings } };
}

/** Adapter `executiveDecisionsActions.ts` calls directly — never re-detects, only translates `evaluateFieldOperationsPlatformHealthAction`'s findings into `OperationalRecommendation`s. */
export async function fieldOperationsRecommendationsForExecutiveDecisions() {
  const memberSession = await resolveMemberSessionSnapshot();
  if (memberSession.kind !== "active") return [];
  const result = await evaluateFieldOperationsPlatformHealthAction();
  if (!result.success) return [];
  const operations = result.data.results.map((r) => r.fieldOperation);
  return fieldOperationFindingsToRecommendations(result.data.findings, operations, memberSession.workspace.id);
}
