"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCoreRouteOptimizationService, type CreateRoutePlanInput } from "@/core/routeOptimization";
import { getCoreDispatchOrdersService } from "@/core/dispatch";
import { getCoreExecutionPackagesService } from "@/core/executionPackage";
import { evaluateRouteEligibility, buildRouteStructure } from "@/core/routeOptimization/routeEngine";
import { validateRoute } from "@/core/routeOptimization/routeValidationEngine";
import { computeTravelEstimate } from "@/core/routeOptimization/travelEngine";
import { optimizeRoute } from "@/core/routeOptimization/optimizationEngine";
import { computeRouteHealthScores } from "@/core/routeOptimization/routeHealthEngine";
import { explainRoute } from "@/core/routeOptimization/routeExplanationEngine";
import { routeCreatedEvent, routeOptimizedEvent, routeValidatedEvent, routeApprovedEvent, routeArchivedEvent, optimizationRecalculatedEvent } from "@/core/routeOptimization/routeTimelineEngine";
import { detectRouteRisks, type RouteRiskInput } from "@/core/routeOptimization/routeRiskEngine";
import { routeFindingsToRecommendations } from "@/core/routeOptimization/routeFindingsEngine";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { generateId } from "@/lib/data/utils";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { RoutePlan, RouteValidationInput, Route, RouteFinding } from "@/types/routeOptimization";

/**
 * v2.0 Checkpoint 30 — Route Optimization Platform module layer.
 * Dispatch (28) assigns work; Field Operations (29) executes work and
 * tracks its state. This file only calculates and manages ROUTES — no
 * GPS, no maps, no route optimization performed by any external map/
 * traffic provider, no AI, no modification of Dispatch or Field
 * Operations state, no rebuilding of Execution Packages. Every action
 * resolves the same real Dispatch Order/Assignment/Execution Package a
 * `RoutePlan` was built from — never a second, duplicate resolution.
 */

const GENERIC_ACCESS_ERROR = "Route Optimization isn't available. You may not have access to it.";
const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function recordRouteTimelineEvent(workspaceId: string, node: KnowledgeNodeRef | null, event: { type: TimelineActivityType; description: string }): void {
  const ownerType = node?.nodeType ?? "workspace";
  const ownerId = node?.nodeId ?? workspaceId;
  if (!ENTITY_TYPE_SET.has(ownerType)) return;
  recordTimelineActivity(workspaceId, ownerType as EntityType, ownerId, event.type, event.description);
}

async function fetchRoutePlanOrFail(id: string, workspaceId: string): Promise<{ routePlan: RoutePlan } | { error: string }> {
  const routePlan = await getCoreRouteOptimizationService().getRoutePlanById(id);
  if (!routePlan || routePlan.workspace_id !== workspaceId) return { error: "This route plan could not be found." };
  return { routePlan };
}

interface EvaluationContext {
  routePlan: RoutePlan;
  validationInput: RouteValidationInput;
}

/** Resolves the real Dispatch Order/Assignment/Execution Package a `RoutePlan` was built from and derives `RouteValidationEngine`'s own input facts from their current live state — never a re-derivation of Dispatch/Execution Package's own decisions, only a read of what they already decided. */
async function resolveEvaluationContext(routePlan: RoutePlan): Promise<EvaluationContext | { error: string }> {
  const order = await getCoreDispatchOrdersService().getOrderById(routePlan.dispatch_order_id);
  if (!order) return { error: "The source dispatch order could not be found." };
  const assignment = order.assignments.find((a) => a.id === routePlan.dispatch_assignment_id);

  const pkg = await getCoreExecutionPackagesService().getPackageById(routePlan.execution_package_id);
  if (!pkg) return { error: "The source execution package could not be found." };

  const currentVersion = routePlan.versions[routePlan.versions.length - 1];
  const validationInput: RouteValidationInput = {
    assignmentExists: assignment !== undefined,
    workerAssigned: order.assignments.some((a) => a.resource_type === "worker"),
    vehicleAssignedPlaceholder: true,
    executionPackageApproved: pkg.status === "approved",
    dispatchActive: order.status === "dispatched" && assignment?.queue_state === "accepted",
    waypoints: currentVersion.snapshot.waypoints,
    segments: currentVersion.snapshot.segments,
  };

  return { routePlan, validationInput };
}

async function evaluateRoutePlan(routePlan: RoutePlan): Promise<Route | { error: string }> {
  const context = await resolveEvaluationContext(routePlan);
  if ("error" in context) return context;

  const validation = validateRoute(context.validationInput);
  const currentVersion = routePlan.versions[routePlan.versions.length - 1];
  const snapshot = currentVersion.snapshot;
  const phaseStopCount = snapshot.waypoints.filter((w) => w.kind === "phase_stop").length;

  const travelEstimate = computeTravelEstimate({ travelLegs: snapshot.travel_legs, segments: snapshot.segments, departureAt: null });
  const health = computeRouteHealthScores({ travelEstimate, constraints: snapshot.constraints, optimization: snapshot.optimization_result, phaseStopCount });
  const explanation = explainRoute(validation, health, travelEstimate, snapshot.optimization_result, snapshot.constraints, phaseStopCount);

  return { routePlan, snapshot, validation, travelEstimate, optimization: snapshot.optimization_result, health, explanation };
}

export interface BuildRoutePlanInput {
  dispatchOrderId: string;
  dispatchAssignmentId: string;
}

export async function buildRoutePlanAction(input: BuildRoutePlanInput): Promise<ActionResult<RoutePlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("route_optimization.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const order = await getCoreDispatchOrdersService().getOrderById(input.dispatchOrderId);
  if (!order || order.workspace_id !== workspaceId) return { success: false, error: "This dispatch order could not be found." };
  const assignment = order.assignments.find((a) => a.id === input.dispatchAssignmentId);
  if (!assignment) return { success: false, error: "This dispatch assignment could not be found." };
  const pkg = await getCoreExecutionPackagesService().getPackageById(order.execution_package_id);
  if (!pkg) return { success: false, error: "The source execution package could not be found." };

  const eligibility = evaluateRouteEligibility({ assignmentQueueState: assignment.queue_state, packageStatus: pkg.status });
  if (!eligibility.canBuild) return { success: false, error: eligibility.reason ?? "This route plan cannot be built." };

  const version = pkg.versions.find((v) => v.id === order.execution_version_id);
  const routePlanId = generateId("route_plan");
  const structure = buildRouteStructure(routePlanId, version?.snapshot.phases ?? []);

  const createInput: CreateRoutePlanInput = {
    id: routePlanId,
    dispatch_order_id: order.id,
    dispatch_assignment_id: assignment.id,
    execution_package_id: pkg.id,
    execution_version_id: order.execution_version_id,
    operational_plan_id: version?.snapshot.operational_plan_id ?? null,
    priority: order.priority,
    context: pkg.context.context,
    waypoints: structure.waypoints,
    segments: structure.segments,
    travel_legs: structure.travelLegs,
    constraints: [],
  };
  const result = await getCoreRouteOptimizationService().createRoutePlan(workspaceId, session.membership.id, createInput);
  if (!result.success) return { success: false, error: result.error };

  recordRouteTimelineEvent(workspaceId, result.data.context, routeCreatedEvent());
  return { success: true, data: result.data };
}

export async function listRoutePlansAction(includeArchived = false): Promise<ActionResult<RoutePlan[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const routePlans = await getCoreRouteOptimizationService().listRoutePlansForWorkspace(session.workspace.id, includeArchived);
  return { success: true, data: routePlans };
}

export async function getRoutePlanAction(id: string): Promise<ActionResult<RoutePlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchRoutePlanOrFail(id, session.workspace.id);
  if ("error" in found) return { success: false, error: found.error };
  return { success: true, data: found.routePlan };
}

export async function evaluateRoutePlanAction(id: string): Promise<ActionResult<Route>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchRoutePlanOrFail(id, session.workspace.id);
  if ("error" in found) return { success: false, error: found.error };
  const result = await evaluateRoutePlan(found.routePlan);
  if ("error" in result) return { success: false, error: result.error };
  return { success: true, data: result };
}

/** Runs the Optimization Engine over the plan's current stop order and appends a fresh version carrying the reordered waypoints/segments/travel legs. Emits `route_optimized` the first time a plan is ever optimized, `optimization_recalculated` every time after — both named Timeline events, never a duplicate of Dispatch/Field Operations' own Timeline integration. */
export async function optimizeRoutePlanAction(id: string): Promise<ActionResult<RoutePlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("route_optimization.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchRoutePlanOrFail(id, workspaceId);
  if ("error" in found) return { success: false, error: found.error };

  const currentVersion = found.routePlan.versions[found.routePlan.versions.length - 1];
  const wasEverOptimized = found.routePlan.versions.some((v) => v.snapshot.optimization_result !== null);
  const snapshot = currentVersion.snapshot;

  const optimized = optimizeRoute({ routePlanId: found.routePlan.id, waypoints: snapshot.waypoints, travelLegs: snapshot.travel_legs, segments: snapshot.segments });

  const result = await getCoreRouteOptimizationService().appendOptimizedVersion(id, workspaceId, { waypoints: optimized.waypoints, segments: optimized.segments, travel_legs: optimized.travelLegs, optimization_result: optimized.optimization });
  if (!result.success) return { success: false, error: result.error };

  const event = wasEverOptimized ? optimizationRecalculatedEvent(optimized.optimization.optimizationScore) : routeOptimizedEvent(optimized.optimization.optimizationScore);
  recordRouteTimelineEvent(workspaceId, result.data.context, event);
  return { success: true, data: result.data };
}

export async function validateRoutePlanAction(id: string): Promise<ActionResult<RoutePlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("route_optimization.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchRoutePlanOrFail(id, workspaceId);
  if ("error" in found) return { success: false, error: found.error };

  const evaluated = await evaluateRoutePlan(found.routePlan);
  if ("error" in evaluated) return { success: false, error: evaluated.error };
  if (!evaluated.validation.valid) return { success: false, error: evaluated.validation.errors[0]?.detail ?? "This route is not valid." };

  const result = await getCoreRouteOptimizationService().setRoutePlanStatus(id, workspaceId, "validated");
  if (!result.success) return { success: false, error: result.error };

  recordRouteTimelineEvent(workspaceId, result.data.context, routeValidatedEvent());
  return { success: true, data: result.data };
}

export async function approveRoutePlanAction(id: string): Promise<ActionResult<RoutePlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("route_optimization.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchRoutePlanOrFail(id, workspaceId);
  if ("error" in found) return { success: false, error: found.error };
  if (found.routePlan.status !== "validated") return { success: false, error: "Only a validated route plan can be approved." };

  const result = await getCoreRouteOptimizationService().setRoutePlanStatus(id, workspaceId, "approved");
  if (!result.success) return { success: false, error: result.error };

  recordRouteTimelineEvent(workspaceId, result.data.context, routeApprovedEvent());
  return { success: true, data: result.data };
}

export async function archiveRoutePlanAction(id: string): Promise<ActionResult<RoutePlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("route_optimization.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchRoutePlanOrFail(id, workspaceId);
  if ("error" in found) return { success: false, error: found.error };

  const result = await getCoreRouteOptimizationService().setRoutePlanStatus(id, workspaceId, "archived");
  if (!result.success) return { success: false, error: result.error };

  recordRouteTimelineEvent(workspaceId, result.data.context, routeArchivedEvent());
  return { success: true, data: result.data };
}

export interface EvaluateRouteOptimizationPlatformHealthResult {
  results: Route[];
  findings: RouteFinding[];
}

export async function evaluateRouteOptimizationPlatformHealthAction(): Promise<ActionResult<EvaluateRouteOptimizationPlatformHealthResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const routePlans = await getCoreRouteOptimizationService().listRoutePlansForWorkspace(session.workspace.id, false);

  const results: Route[] = [];
  const riskInputs: RouteRiskInput[] = [];
  for (const routePlan of routePlans) {
    const result = await evaluateRoutePlan(routePlan);
    if ("error" in result) continue;
    results.push(result);
    riskInputs.push({ routePlanId: routePlan.id, validation: result.validation, health: result.health, optimization: result.optimization });
  }

  const findings = detectRouteRisks(riskInputs);
  return { success: true, data: { results, findings } };
}

/** Adapter `executiveDecisionsActions.ts` calls directly — never re-detects, only translates `evaluateRouteOptimizationPlatformHealthAction`'s findings into `OperationalRecommendation`s. */
export async function routeOptimizationRecommendationsForExecutiveDecisions() {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];
  const result = await evaluateRouteOptimizationPlatformHealthAction();
  if (!result.success) return [];
  const routePlans = result.data.results.map((r) => r.routePlan);
  return routeFindingsToRecommendations(result.data.findings, routePlans, session.workspace.id);
}
