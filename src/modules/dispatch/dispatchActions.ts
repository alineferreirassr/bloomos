"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCoreDispatchOrdersService, getCoreDispatchBatchesService, type CreateDispatchOrderInput } from "@/core/dispatch";
import { getCoreExecutionPackagesService } from "@/core/executionPackage";
import { getCoreAppointmentsService } from "@/core/scheduling";
import { getCoreWorkersService, getCoreTeamsService, getCoreEquipmentService, getCoreVehiclesService } from "@/core/workforce";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { getVendors } from "@/lib/data";
import { validatePackage } from "@/core/executionPackage/packageValidationEngine";
import { computePackageHealthScores } from "@/core/executionPackage/packageHealthEngine";
import { computePackageReadiness } from "@/core/executionPackage/readinessEngine";
import { evaluateDispatchEligibility } from "@/core/dispatch/dispatchBuilderEngine";
import { buildDispatchAssignments } from "@/core/dispatch/assignmentEngine";
import { validateDispatch } from "@/core/dispatch/dispatchValidationEngine";
import { computeDispatchHealthScores } from "@/core/dispatch/dispatchHealthEngine";
import { explainDispatch } from "@/core/dispatch/dispatchExplanationEngine";
import { isLegalQueueTransition } from "@/core/dispatch/dispatchQueueEngine";
import { evaluateAcceptDecision, evaluateDeclineDecision, evaluateTimeoutDecision } from "@/core/dispatch/acceptanceEngine";
import { dispatchCreatedEvent, assignmentCreatedEvent, assignmentAcceptedEvent, assignmentDeclinedEvent, dispatchCancelledEvent, dispatchArchivedEvent, queueUpdatedEvent } from "@/core/dispatch/dispatchTimelineEngine";
import { buildAssignedResourceRelationship } from "@/core/dispatch/dispatchKnowledgeGraphEngine";
import { detectDispatchRisks } from "@/core/dispatch/dispatchRiskEngine";
import { dispatchFindingsToRecommendations } from "@/core/dispatch/dispatchFindingsEngine";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { nowIso } from "@/lib/data/utils";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { ExecutionPackage, ExecutionPriority } from "@/types/executionPackage";
import type { DispatchOrder, DispatchBatch, DispatchOrderResult, DispatchFinding, DispatchQueueState } from "@/types/dispatch";

/**
 * v2.0 Checkpoint 28 — Dispatch Platform module layer. Consumes an
 * approved, ready Execution Package and creates a Dispatch Order that
 * assigns work — it never executes work, never captures GPS/evidence,
 * never optimizes routes, and never recalculates the Capability/
 * Scheduling/Allocation decisions the frozen `ExecutionSnapshot` already
 * carries. Every live-status lookup this file resolves (Worker/Team/
 * Equipment/Vehicle/Vendor status, Appointment activity) is handed to
 * `DispatchValidationEngine` as a plain fact — that engine never fetches
 * anything itself.
 */

const GENERIC_ACCESS_ERROR = "The Dispatch Platform isn't available. You may not have access to it.";
const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function recordDispatchTimelineEvent(workspaceId: string, node: KnowledgeNodeRef | null, event: { type: TimelineActivityType; description: string }): void {
  const ownerType = node?.nodeType ?? "workspace";
  const ownerId = node?.nodeId ?? workspaceId;
  if (!ENTITY_TYPE_SET.has(ownerType)) return;
  recordTimelineActivity(workspaceId, ownerType as EntityType, ownerId, event.type, event.description);
}

async function persistAssignedResourceRelationship(workspaceId: string, createdBy: string, orderContext: KnowledgeNodeRef | null, resourceType: DispatchOrder["assignments"][number]["resource_type"], resourceId: string): Promise<void> {
  const spec = buildAssignedResourceRelationship(orderContext, resourceType, resourceId);
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

async function fetchPackageOrFail(id: string, workspaceId: string): Promise<{ pkg: ExecutionPackage } | { error: string }> {
  const pkg = await getCoreExecutionPackagesService().getPackageById(id);
  if (!pkg || pkg.workspace_id !== workspaceId) return { error: "This execution package could not be found." };
  return { pkg };
}

async function fetchOrderOrFail(id: string, workspaceId: string): Promise<{ order: DispatchOrder } | { error: string }> {
  const order = await getCoreDispatchOrdersService().getOrderById(id);
  if (!order || order.workspace_id !== workspaceId) return { error: "This dispatch order could not be found." };
  return { order };
}

/** The order's own display node — Dispatch Order/Assignment/Batch/Queue have no node identity of their own (reserved vocabulary), so every Timeline/Knowledge Graph write reuses the source Execution Package's context node instead of fabricating one. */
async function resolveOrderContext(order: DispatchOrder): Promise<KnowledgeNodeRef | null> {
  const pkg = await getCoreExecutionPackagesService().getPackageById(order.execution_package_id);
  return pkg?.context.context ?? null;
}

export interface BuildDispatchOrderInput {
  executionPackageId: string;
  batchId: string | null;
  priorityOverride: ExecutionPriority | null;
  source: CreateDispatchOrderInput["source"];
}

export async function buildDispatchOrderAction(input: BuildDispatchOrderInput): Promise<ActionResult<DispatchOrder>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("dispatch.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const found = await fetchPackageOrFail(input.executionPackageId, workspaceId);
  if ("error" in found) return { success: false, error: found.error };
  const { pkg } = found;

  const version = pkg.versions.find((v) => v.id === pkg.current_version_id) ?? pkg.versions[pkg.versions.length - 1];
  if (!version) return { success: false, error: "This execution package has no version to dispatch from." };

  const validation = validatePackage({ snapshot: version.snapshot });
  const health = computePackageHealthScores(version.snapshot);
  const readiness = computePackageReadiness({ validation, health });

  const eligibility = evaluateDispatchEligibility({ packageStatus: pkg.status, packageReadinessState: readiness.state });
  if (!eligibility.canDispatch) return { success: false, error: eligibility.reason ?? "This execution package cannot be dispatched." };

  const assignments = buildDispatchAssignments(version.snapshot.allocation_candidates);
  if (assignments.length === 0) return { success: false, error: "This execution package has no selected resources to assign." };

  const result = await getCoreDispatchOrdersService().createOrder(workspaceId, session.membership.id, {
    execution_package_id: pkg.id,
    execution_version_id: version.id,
    batch_id: input.batchId,
    priority: input.priorityOverride ?? pkg.context.priority,
    source: input.source,
    assignments,
  });
  if (!result.success) return { success: false, error: result.error };

  const orderContext = pkg.context.context;
  recordDispatchTimelineEvent(workspaceId, orderContext, dispatchCreatedEvent(result.data.assignments.length));
  for (const assignment of result.data.assignments) {
    recordDispatchTimelineEvent(workspaceId, orderContext, assignmentCreatedEvent(assignment.resource_type, assignment.resource_id));
    await persistAssignedResourceRelationship(workspaceId, session.membership.id, orderContext, assignment.resource_type, assignment.resource_id);
  }

  return { success: true, data: result.data };
}

export async function listDispatchOrdersAction(includeArchived = false): Promise<ActionResult<DispatchOrder[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const orders = await getCoreDispatchOrdersService().listOrdersForWorkspace(session.workspace.id, includeArchived);
  return { success: true, data: orders };
}

export async function getDispatchOrderAction(id: string): Promise<ActionResult<DispatchOrder>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchOrderOrFail(id, session.workspace.id);
  if ("error" in found) return { success: false, error: found.error };
  return { success: true, data: found.order };
}

async function buildResourceStatusByKey(order: DispatchOrder): Promise<Record<string, string>> {
  const [workers, teams, equipment, vehicles, vendors] = await Promise.all([
    getCoreWorkersService().listWorkersForWorkspace(order.workspace_id),
    getCoreTeamsService().listTeamsForWorkspace(order.workspace_id),
    getCoreEquipmentService().listEquipmentForWorkspace(order.workspace_id),
    getCoreVehiclesService().listVehiclesForWorkspace(order.workspace_id),
    getVendors(),
  ]);
  const workerById = new Map(workers.map((w) => [w.id, w.status] as const));
  const teamById = new Map(teams.map((t) => [t.id, t.status] as const));
  const equipmentById = new Map(equipment.map((e) => [e.id, e.status] as const));
  const vehicleById = new Map(vehicles.map((v) => [v.id, v.status] as const));
  const vendorById = new Map(vendors.map((v) => [v.id, v.status] as const));

  const statusByKey: Record<string, string> = {};
  for (const assignment of order.assignments) {
    const key = `${assignment.resource_type}:${assignment.resource_id}`;
    const status =
      assignment.resource_type === "worker" ? workerById.get(assignment.resource_id) :
      assignment.resource_type === "team" ? teamById.get(assignment.resource_id) :
      assignment.resource_type === "equipment" ? equipmentById.get(assignment.resource_id) :
      assignment.resource_type === "vehicle" ? vehicleById.get(assignment.resource_id) :
      assignment.resource_type === "vendor" ? vendorById.get(assignment.resource_id) :
      undefined;
    if (status !== undefined) statusByKey[key] = status;
  }
  return statusByKey;
}

async function resolveScheduleActive(appointmentId: string | null): Promise<boolean> {
  if (appointmentId === null) return true;
  const appointment = await getCoreAppointmentsService().getAppointmentById(appointmentId);
  if (!appointment) return false;
  return appointment.status !== "cancelled" && appointment.status !== "completed";
}

async function evaluateOrder(order: DispatchOrder): Promise<DispatchOrderResult> {
  const pkg = await getCoreExecutionPackagesService().getPackageById(order.execution_package_id);
  const version = pkg?.versions.find((v) => v.id === order.execution_version_id);

  const packageStatus = pkg?.status ?? "archived";
  let packageReadinessState: Parameters<typeof evaluateDispatchEligibility>[0]["packageReadinessState"] = "incomplete";
  if (pkg && version) {
    const validationResult = validatePackage({ snapshot: version.snapshot });
    const healthResult = computePackageHealthScores(version.snapshot);
    packageReadinessState = computePackageReadiness({ validation: validationResult, health: healthResult }).state;
  }

  const resourceStatusByKey = await buildResourceStatusByKey(order);
  const scheduleActive = version ? await resolveScheduleActive(version.snapshot.appointment_id) : true;

  const validation = version
    ? validateDispatch({ order, snapshot: version.snapshot, packageStatus, packageReadinessState, resourceStatusByKey, scheduleActive })
    : { valid: false, errors: [{ rule: "package_not_ready", detail: "The source execution package or version could not be found." }], warnings: [] };

  const health = computeDispatchHealthScores(order.assignments, validation.valid);
  const explanation = explainDispatch(validation, health, order.assignments);

  return { order, validation, health, explanation };
}

export async function evaluateDispatchOrderAction(id: string): Promise<ActionResult<DispatchOrderResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchOrderOrFail(id, session.workspace.id);
  if ("error" in found) return { success: false, error: found.error };
  return { success: true, data: await evaluateOrder(found.order) };
}

async function respondToAssignment(orderId: string, assignmentId: string, nextState: DispatchQueueState, reason: string | null): Promise<ActionResult<DispatchOrder>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("dispatch.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchOrderOrFail(orderId, workspaceId);
  if ("error" in found) return { success: false, error: found.error };
  const assignment = found.order.assignments.find((a) => a.id === assignmentId);
  if (!assignment) return { success: false, error: "This dispatch assignment could not be found." };

  let decision: { allowed: boolean; error: string | null };
  if (nextState === "accepted") decision = evaluateAcceptDecision(assignment);
  else if (nextState === "declined") decision = evaluateDeclineDecision(assignment, reason ?? "");
  else if (nextState === "expired") decision = evaluateTimeoutDecision(assignment, nowIso());
  else if (nextState === "assigned" || nextState === "pending" || nextState === "cancelled") {
    decision = { allowed: isLegalQueueTransition(assignment.queue_state, nextState), error: `Cannot transition from "${assignment.queue_state}" to "${nextState}".` };
  } else decision = { allowed: false, error: "Unsupported transition." };

  if (!decision.allowed) return { success: false, error: decision.error ?? "This transition is not allowed." };

  const result = await getCoreDispatchOrdersService().transitionAssignment(orderId, workspaceId, assignmentId, nextState, reason);
  if (!result.success) return { success: false, error: result.error };

  const orderContext = await resolveOrderContext(result.data);
  if (nextState === "accepted") recordDispatchTimelineEvent(workspaceId, orderContext, assignmentAcceptedEvent(assignment.resource_type, assignment.resource_id));
  else if (nextState === "declined") recordDispatchTimelineEvent(workspaceId, orderContext, assignmentDeclinedEvent(assignment.resource_type, assignment.resource_id, reason ?? ""));
  recordDispatchTimelineEvent(workspaceId, orderContext, queueUpdatedEvent(nextState));

  return { success: true, data: result.data };
}

/** Advances `queued` → `assigned` — the resource has been locked in, but not yet presented with the work. */
export async function assignDispatchAssignmentAction(orderId: string, assignmentId: string): Promise<ActionResult<DispatchOrder>> {
  return respondToAssignment(orderId, assignmentId, "assigned", null);
}

/** Advances `assigned` → `pending` — the assignment is now presented and awaiting the resource's response. */
export async function presentDispatchAssignmentAction(orderId: string, assignmentId: string): Promise<ActionResult<DispatchOrder>> {
  return respondToAssignment(orderId, assignmentId, "pending", null);
}

export async function acceptDispatchAssignmentAction(orderId: string, assignmentId: string): Promise<ActionResult<DispatchOrder>> {
  return respondToAssignment(orderId, assignmentId, "accepted", null);
}

export async function declineDispatchAssignmentAction(orderId: string, assignmentId: string, reason: string): Promise<ActionResult<DispatchOrder>> {
  return respondToAssignment(orderId, assignmentId, "declined", reason);
}

export async function timeoutDispatchAssignmentAction(orderId: string, assignmentId: string): Promise<ActionResult<DispatchOrder>> {
  return respondToAssignment(orderId, assignmentId, "expired", null);
}

export async function cancelDispatchAssignmentAction(orderId: string, assignmentId: string, reason: string | null): Promise<ActionResult<DispatchOrder>> {
  return respondToAssignment(orderId, assignmentId, "cancelled", reason);
}

async function setDispatchOrderStatusAction(id: string, status: "dispatched" | "cancelled" | "archived"): Promise<ActionResult<DispatchOrder>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("dispatch.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchOrderOrFail(id, workspaceId);
  if ("error" in found) return { success: false, error: found.error };

  const result = await getCoreDispatchOrdersService().setOrderStatus(id, workspaceId, status);
  if (!result.success) return { success: false, error: result.error };

  const orderContext = await resolveOrderContext(result.data);
  if (status === "cancelled") recordDispatchTimelineEvent(workspaceId, orderContext, dispatchCancelledEvent());
  if (status === "archived") recordDispatchTimelineEvent(workspaceId, orderContext, dispatchArchivedEvent());

  return { success: true, data: result.data };
}

export async function dispatchOrderAction(id: string): Promise<ActionResult<DispatchOrder>> {
  return setDispatchOrderStatusAction(id, "dispatched");
}

export async function cancelDispatchOrderAction(id: string): Promise<ActionResult<DispatchOrder>> {
  return setDispatchOrderStatusAction(id, "cancelled");
}

export async function archiveDispatchOrderAction(id: string): Promise<ActionResult<DispatchOrder>> {
  return setDispatchOrderStatusAction(id, "archived");
}

export interface CreateDispatchBatchActionInput {
  name: string;
  orderIds: string[];
}

export async function createDispatchBatchAction(input: CreateDispatchBatchActionInput): Promise<ActionResult<DispatchBatch>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("dispatch.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreDispatchBatchesService().createBatch(session.workspace.id, session.membership.id, { name: input.name, order_ids: input.orderIds });
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function listDispatchBatchesAction(): Promise<ActionResult<DispatchBatch[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const batches = await getCoreDispatchBatchesService().listBatchesForWorkspace(session.workspace.id);
  return { success: true, data: batches };
}

export interface EvaluateDispatchPlatformHealthResult {
  results: DispatchOrderResult[];
  findings: DispatchFinding[];
}

export async function evaluateDispatchPlatformHealthAction(): Promise<ActionResult<EvaluateDispatchPlatformHealthResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const orders = await getCoreDispatchOrdersService().listOrdersForWorkspace(session.workspace.id, false);

  const results: DispatchOrderResult[] = [];
  for (const order of orders) {
    results.push(await evaluateOrder(order));
  }

  const findings = detectDispatchRisks(results);
  return { success: true, data: { results, findings } };
}

/** Adapter `executiveDecisionsActions.ts` calls directly — never re-detects, only translates `evaluateDispatchPlatformHealthAction`'s findings into `OperationalRecommendation`s. */
export async function dispatchRecommendationsForExecutiveDecisions() {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];
  const result = await evaluateDispatchPlatformHealthAction();
  if (!result.success) return [];
  const orders = result.data.results.map((r) => r.order);
  return dispatchFindingsToRecommendations(result.data.findings, orders, session.workspace.id);
}
