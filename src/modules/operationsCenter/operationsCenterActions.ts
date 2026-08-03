"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { nowIso } from "@/lib/data/utils";

import { evaluateDispatchPlatformHealthAction, type EvaluateDispatchPlatformHealthResult } from "@/modules/dispatch/dispatchActions";
import { evaluateFieldOperationsPlatformHealthAction, type EvaluateFieldOperationsPlatformHealthResult } from "@/modules/fieldOperations/fieldOperationsActions";
import { evaluateRouteOptimizationPlatformHealthAction, type EvaluateRouteOptimizationPlatformHealthResult } from "@/modules/routeOptimization/routeOptimizationActions";
import { evaluateWorkspaceSchedulingAction, type EvaluateWorkspaceSchedulingResult } from "@/modules/scheduling/schedulingActions";
import { evaluateResourceAllocationHealthAction, type EvaluateResourceAllocationHealthResult } from "@/modules/allocation/allocationActions";
import { evaluateExecutionPackagePlatformHealthAction, type EvaluateExecutionPackagePlatformHealthResult } from "@/modules/executionPackage/executionPackageActions";
import { evaluateWorkforceAction, listLocationSnapshotsAction, type EvaluateWorkforceResult } from "@/modules/workforce/workforceActions";
import { evaluateExecutiveDecisionsAction, type EvaluateExecutiveDecisionsResult } from "@/modules/executiveDecisions/executiveDecisionsActions";
import { evaluateObjectivesAction, type EvaluateObjectivesResult } from "@/modules/objectives/objectivesActions";
import { evaluateBusinessHealthAction, type BusinessHealthEvaluation } from "@/modules/knowledgeGraph/businessHealthActions";
import { getKnowledgeHealthAction } from "@/modules/knowledgeGraph/knowledgeGraphActions";
import type { KnowledgeHealthReport } from "@/core/knowledge/knowledgeHealthEngine";

import { getCoreOperationalAlertsService, getCoreOperationalIncidentsService, type CreateIncidentInput } from "@/core/operationsCenter";
import { aggregateFromSources, getSourceData, type SourceFetcher } from "@/core/operationsCenter/crossModuleAggregationEngine";
import { computeOperationalSnapshot, type SnapshotSourceData } from "@/core/operationsCenter/operationalSnapshotEngine";
import { computeOperationalStatus } from "@/core/operationsCenter/operationalStatusEngine";
import { detectOperationalSignals } from "@/core/operationsCenter/operationalAlertEngine";
import { reconcileAlerts } from "@/core/operationsCenter/alertLifecycleEngine";
import { groupCriticalAlerts, buildIncidentFromAlerts } from "@/core/operationsCenter/incidentEngine";
import { buildOperationalFeed, filterFeed, sortFeedChronological, sortFeedByPriority, type FeedFilter } from "@/core/operationsCenter/operationsFeedEngine";
import { computeOperationalKpis } from "@/core/operationsCenter/operationsKpiEngine";
import { computeOperationsCenterHealth } from "@/core/operationsCenter/operationsCenterHealthEngine";
import { buildPriorityQueue, sortPriorityQueue } from "@/core/operationsCenter/priorityQueueEngine";
import { computeResourceOverview } from "@/core/operationsCenter/resourceOverviewEngine";
import { computeOperationalLocationSummary } from "@/core/operationsCenter/operationalMapPlaceholderEngine";
import { buildOperationalDigest } from "@/core/operationsCenter/communicationIntegrationEngine";
import { computeOperationsBrief } from "@/core/operationsCenter/operationsBriefEngine";
import { readActivities } from "@/lib/data/mock/timelineStore";

import type { AlertStatus, IncidentStatus, OperationalAlert, OperationalIncident, OperationalKpiSnapshot, OperationsBrief } from "@/types/operationsCenter";
import type { AvailabilitySummary } from "@/types/workforce";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

const GENERIC_ACCESS_ERROR = "The operations center isn't available. You may not have access to it.";
const RECENT_TIMELINE_ACTIVITY_LIMIT = 25;

/**
 * v2.0 Checkpoint 31 — the Operations Center's own module layer. This
 * file never introduces a new source of truth: `evaluateOperationsCenterAction`
 * fetches every dependency through the exact same public Server Actions
 * every other checkpoint's own dashboard already calls, feeds them
 * through this checkpoint's own pure engines, and returns one coherent
 * read. The only two things this file ever writes are `OperationalAlert`
 * and `OperationalIncident` records — never a source module's own state.
 */

export interface EvaluateOperationsCenterResult {
  snapshot: ReturnType<typeof computeOperationalSnapshot>;
  status: ReturnType<typeof computeOperationalStatus>;
  alerts: OperationalAlert[];
  incidents: OperationalIncident[];
  kpis: OperationalKpiSnapshot;
  health: ReturnType<typeof computeOperationsCenterHealth>;
  priorityQueue: ReturnType<typeof buildPriorityQueue>;
  resourceOverview: ReturnType<typeof computeResourceOverview>;
  locationSummary: ReturnType<typeof computeOperationalLocationSummary>;
  digest: string;
}

async function gatherSourceData(workspaceId: string) {
  const fetchers: SourceFetcher<unknown>[] = [
    { source: "dispatch", fetch: () => evaluateDispatchPlatformHealthAction() },
    { source: "field_operations", fetch: () => evaluateFieldOperationsPlatformHealthAction() },
    { source: "route_optimization", fetch: () => evaluateRouteOptimizationPlatformHealthAction() },
    { source: "scheduling", fetch: () => evaluateWorkspaceSchedulingAction() },
    { source: "allocation", fetch: () => evaluateResourceAllocationHealthAction() },
    { source: "execution_package", fetch: () => evaluateExecutionPackagePlatformHealthAction() },
    { source: "workforce", fetch: () => evaluateWorkforceAction() },
    { source: "executive_decisions", fetch: () => evaluateExecutiveDecisionsAction() },
    { source: "objectives", fetch: () => evaluateObjectivesAction() },
    { source: "business_health", fetch: () => evaluateBusinessHealthAction() },
    { source: "knowledge_health", fetch: () => getKnowledgeHealthAction() },
  ];

  const { outcomes, confidence } = await aggregateFromSources(workspaceId, fetchers);

  const dispatch = getSourceData<EvaluateDispatchPlatformHealthResult>(outcomes, "dispatch");
  const fieldOps = getSourceData<EvaluateFieldOperationsPlatformHealthResult>(outcomes, "field_operations");
  const route = getSourceData<EvaluateRouteOptimizationPlatformHealthResult>(outcomes, "route_optimization");
  const scheduling = getSourceData<EvaluateWorkspaceSchedulingResult>(outcomes, "scheduling");
  const allocation = getSourceData<EvaluateResourceAllocationHealthResult>(outcomes, "allocation");
  const executionPackage = getSourceData<EvaluateExecutionPackagePlatformHealthResult>(outcomes, "execution_package");
  const workforce = getSourceData<EvaluateWorkforceResult>(outcomes, "workforce");
  const executiveDecisions = getSourceData<EvaluateExecutiveDecisionsResult>(outcomes, "executive_decisions");
  const objectives = getSourceData<EvaluateObjectivesResult>(outcomes, "objectives");
  const businessHealth = getSourceData<BusinessHealthEvaluation>(outcomes, "business_health");
  const knowledgeHealth = getSourceData<KnowledgeHealthReport>(outcomes, "knowledge_health");

  const locationResult = await listLocationSnapshotsAction();
  const locationSnapshots = locationResult.success ? locationResult.data : [];

  const recentTimelineActivity = readActivities()
    .filter((a) => a.workspace_id === workspaceId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, RECENT_TIMELINE_ACTIVITY_LIMIT);

  const dispatchOrders = dispatch?.results.map((r) => r.order) ?? [];
  const dispatchHealthScores = dispatch?.results.map((r) => r.health.overallDispatchHealth) ?? [];

  const fieldOperations = fieldOps?.results.map((r) => r.fieldOperation) ?? [];
  const executionHealthScores = fieldOps?.results.map((r) => r.health.overallOperationalHealth) ?? [];

  const routeResults = route?.results ?? [];
  const routePlans = routeResults.map((r) => r.routePlan);
  const routeHealthScores = routeResults.map((r) => r.health.overallRouteHealth);

  const schedulingFindings = scheduling?.findings ?? [];
  const schedulingHealthScores = scheduling ? Object.values(scheduling.scoresByCalendarId).map((s) => s.calendarHealthScore) : [];

  const allocationFindings = allocation?.findings ?? [];
  const allocationFindingCounts = { high: allocationFindings.filter((f) => f.severity === "high").length, medium: allocationFindings.filter((f) => f.severity === "medium").length };

  const packageReadinessByPackageId = executionPackage?.readinessByPackageId ?? {};
  const packageHealthScores = executionPackage ? Object.values(executionPackage.healthByPackageId).map((h) => h.overallPackageHealth) : [];

  const workforceScorecard = workforce?.scorecard ?? null;
  const equipmentUtilization = workforce?.equipmentUtilization ?? null;
  const vehicleUtilization = workforce?.vehicleUtilization ?? null;
  const teamsActive = workforceScorecard?.teamsCount ?? 0;
  // No public action exposes Workforce's own `AvailabilitySummary` directly (only baked
  // into `scorecard`) — shimmed here from the two real numbers the Scorecard already
  // computed (`availableNow`/`onAssignmentNow`), folding everything else into `offDuty`
  // as a disclosed coarser bucket rather than a new availability calculation.
  const availabilitySummary: AvailabilitySummary | null = workforceScorecard
    ? { available: workforceScorecard.availableNow, onAssignment: workforceScorecard.onAssignmentNow, busy: 0, onBreak: 0, offDuty: Math.max(0, workforceScorecard.totalWorkers - workforceScorecard.availableNow - workforceScorecard.onAssignmentNow), vacation: 0, sickLeave: 0, training: 0, unavailable: 0 }
    : null;

  const criticalExecutiveDecisions = (executiveDecisions?.allDecisions ?? []).filter((d) => d.priority === "critical");
  const blockedObjectivesCount = objectives?.scorecard.objectivesBlocked ?? 0;
  const objectiveHealthScore = objectives?.scorecard.overallOperationalScore ?? 100;

  const businessHealthScore = businessHealth?.businessHealth.overallScore ?? 100;
  const knowledgeIssueCount = knowledgeHealth ? knowledgeHealth.brokenRelationships.length + knowledgeHealth.orphanedAssets.length + knowledgeHealth.duplicateRelationshipGroups.length + knowledgeHealth.circularReferenceGroups.length + knowledgeHealth.constraintViolations.length : 0;
  const knowledgeHealthScore = Math.max(0, 100 - knowledgeIssueCount * 5);

  const snapshotData: SnapshotSourceData = {
    dispatchOrders,
    fieldOperations,
    routePlans,
    routeResults,
    schedulingFindings,
    allocationFindings,
    packageReadinessByPackageId,
    workforceScorecard,
    equipmentUtilization,
    vehicleUtilization,
    criticalExecutiveDecisions,
    blockedObjectivesCount,
    businessHealthScore,
    knowledgeHealthScore,
    recentTimelineActivity,
  };

  return {
    outcomes,
    confidence,
    snapshotData,
    dispatchHealthScores,
    executionHealthScores,
    routeHealthScores,
    schedulingHealthScores,
    packageHealthScores,
    allocationFindingCounts,
    objectiveHealthScore,
    knowledgeIssueCount,
    workforceScorecard,
    equipmentUtilization,
    vehicleUtilization,
    availabilitySummary,
    teamsActive,
    locationSnapshots,
    routeResults,
  };
}

/** The single big orchestrator every Operations Center surface reads from — mirrors every other checkpoint's own `evaluate<X>Action()`. Fetches every dependency once, runs it through this checkpoint's own engines, and reconciles the Alert/Incident stores against what it finds. */
export async function evaluateOperationsCenterAction(): Promise<ActionResult<EvaluateOperationsCenterResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const gathered = await gatherSourceData(workspaceId);

  const snapshot = computeOperationalSnapshot(workspaceId, gathered.snapshotData, gathered.outcomes, gathered.confidence);
  const status = computeOperationalStatus(snapshot);

  const alertsRepository = getCoreOperationalAlertsService();
  const signals = detectOperationalSignals(gathered.snapshotData);
  await reconcileAlerts(workspaceId, signals, alertsRepository);
  const alerts = await alertsRepository.listAlertsForWorkspace(workspaceId);

  const incidentsRepository = getCoreOperationalIncidentsService();
  const existingIncidents = await incidentsRepository.listIncidentsForWorkspace(workspaceId, true);
  for (const group of groupCriticalAlerts(alerts)) {
    const alreadyCovered = existingIncidents.some((incident) => group.every((alert) => incident.source_alert_ids.includes(alert.id)));
    if (alreadyCovered) continue;
    const input: CreateIncidentInput = buildIncidentFromAlerts(group);
    const created = await incidentsRepository.createIncident(workspaceId, input);
    if (created.success) recordTimelineActivity(workspaceId, "operational_incident", created.data.id, "operational_incident_opened", `Incident opened: ${created.data.title}`);
  }
  const incidents = await incidentsRepository.listIncidentsForWorkspace(workspaceId, true);

  const kpis = computeOperationalKpis({ snapshot, status, routeResults: gathered.routeResults, alerts, incidents, fieldOperationHealthScores: gathered.executionHealthScores });

  const health = computeOperationsCenterHealth({
    businessHealthScore: gathered.snapshotData.businessHealthScore ?? 100,
    objectiveHealthScore: gathered.objectiveHealthScore,
    packageHealthScores: gathered.packageHealthScores,
    schedulingHealthScores: gathered.schedulingHealthScores,
    knowledgeIssueCount: gathered.knowledgeIssueCount,
    allocationFindingCounts: gathered.allocationFindingCounts,
    workforceScorecard: gathered.workforceScorecard ? { availableNow: gathered.workforceScorecard.availableNow, totalWorkers: gathered.workforceScorecard.totalWorkers } : null,
    dispatchHealthScores: gathered.dispatchHealthScores,
    executionHealthScores: gathered.executionHealthScores,
    routeHealthScores: gathered.routeHealthScores,
  });

  const priorityQueue = sortPriorityQueue(
    buildPriorityQueue({
      dispatchOrders: gathered.snapshotData.dispatchOrders ?? [],
      fieldOperations: gathered.snapshotData.fieldOperations ?? [],
      routeResults: gathered.routeResults,
      schedulingFindings: gathered.snapshotData.schedulingFindings ?? [],
      criticalExecutiveDecisions: gathered.snapshotData.criticalExecutiveDecisions ?? [],
      blockedObjectivesCount: gathered.snapshotData.blockedObjectivesCount ?? 0,
      alerts,
      incidents,
      bottlenecks: [],
    }),
  );

  const resourceOverview = computeResourceOverview({ availabilitySummary: gathered.availabilitySummary, teamsActive: gathered.teamsActive, equipmentUtilization: gathered.equipmentUtilization, vehicleUtilization: gathered.vehicleUtilization, criticalSinglePointsOfFailure: [] });

  const locationSummary = computeOperationalLocationSummary({ workerLocationSnapshots: gathered.locationSnapshots, totalWorkerCount: gathered.workforceScorecard?.totalWorkers ?? 0, knownOperationLocationsCount: 0, knownRouteWaypointsCount: gathered.routeResults.reduce((sum, r) => sum + r.snapshot.waypoints.length, 0), now: nowIso() });

  const digest = buildOperationalDigest(status, kpis);

  return { success: true, data: { snapshot, status, alerts, incidents, kpis, health, priorityQueue, resourceOverview, locationSummary, digest } };
}

export async function getOperationsBriefAction(previousKpis: OperationalKpiSnapshot | null = null): Promise<ActionResult<OperationsBrief>> {
  const evaluation = await evaluateOperationsCenterAction();
  if (!evaluation.success) return evaluation;
  const { snapshot, status, kpis, priorityQueue, incidents } = evaluation.data;
  const brief = computeOperationsBrief({ snapshot, status, kpis, priorityQueue, openIncidents: incidents.filter((i) => i.status !== "resolved"), previousKpis }, nowIso());
  return { success: true, data: brief };
}

export async function getOperationalFeedAction(filter: FeedFilter = {}, sortBy: "chronological" | "priority" = "chronological"): Promise<ActionResult<ReturnType<typeof buildOperationalFeed>>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const alertsRepository = getCoreOperationalAlertsService();
  const incidentsRepository = getCoreOperationalIncidentsService();
  const [alerts, incidents] = await Promise.all([alertsRepository.listAlertsForWorkspace(workspaceId, true), incidentsRepository.listIncidentsForWorkspace(workspaceId, true)]);
  const timelineActivity = readActivities()
    .filter((a) => a.workspace_id === workspaceId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, RECENT_TIMELINE_ACTIVITY_LIMIT);

  const items = buildOperationalFeed({ alerts, incidents, timelineActivity });
  const filtered = filterFeed(items, filter);
  const sorted = sortBy === "priority" ? sortFeedByPriority(filtered) : sortFeedChronological(filtered);
  return { success: true, data: sorted };
}

export async function listOperationalAlertsAction(includeResolved = false): Promise<ActionResult<OperationalAlert[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const alerts = await getCoreOperationalAlertsService().listAlertsForWorkspace(session.workspace.id, includeResolved);
  return { success: true, data: alerts };
}

export async function getOperationalAlertAction(id: string): Promise<ActionResult<OperationalAlert>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const alert = await getCoreOperationalAlertsService().getAlertById(id);
  if (!alert || alert.workspace_id !== session.workspace.id) return { success: false, error: "This alert could not be found." };
  return { success: true, data: alert };
}

const ALERT_STATUS_TIMELINE_TYPES: Partial<Record<AlertStatus, "operational_alert_acknowledged" | "operational_alert_resolved" | "operational_alert_dismissed" | "operational_alert_escalated">> = {
  acknowledged: "operational_alert_acknowledged",
  resolved: "operational_alert_resolved",
  dismissed: "operational_alert_dismissed",
  escalated: "operational_alert_escalated",
};

const ALERT_STATUS_TIMELINE_LABELS: Record<string, string> = {
  operational_alert_acknowledged: "Alert acknowledged",
  operational_alert_resolved: "Alert resolved",
  operational_alert_dismissed: "Alert dismissed",
  operational_alert_escalated: "Alert escalated",
};

function recordAlertTransitionTimelineEvent(alert: OperationalAlert): void {
  const timelineType = ALERT_STATUS_TIMELINE_TYPES[alert.status];
  if (!timelineType) return;
  recordTimelineActivity(alert.workspace_id, "operational_alert", alert.id, timelineType, `${ALERT_STATUS_TIMELINE_LABELS[timelineType]}: ${alert.title}`);
}

export async function acknowledgeAlertAction(id: string): Promise<ActionResult<OperationalAlert>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operations_alerts.acknowledge")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreOperationalAlertsService().acknowledgeAlert(id, session.workspace.id, session.membership.id);
  if (!result.success) return { success: false, error: result.error };
  recordAlertTransitionTimelineEvent(result.data);
  return { success: true, data: result.data };
}

export async function resolveAlertAction(id: string, reason: string): Promise<ActionResult<OperationalAlert>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operations_alerts.resolve")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreOperationalAlertsService().resolveAlert(id, session.workspace.id, session.membership.id, reason);
  if (!result.success) return { success: false, error: result.error };
  recordAlertTransitionTimelineEvent(result.data);
  return { success: true, data: result.data };
}

export async function dismissAlertAction(id: string, reason: string): Promise<ActionResult<OperationalAlert>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operations_alerts.acknowledge")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreOperationalAlertsService().dismissAlert(id, session.workspace.id, session.membership.id, reason);
  if (!result.success) return { success: false, error: result.error };
  recordAlertTransitionTimelineEvent(result.data);
  return { success: true, data: result.data };
}

export async function escalateAlertAction(id: string): Promise<ActionResult<OperationalAlert>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operations_alerts.acknowledge")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreOperationalAlertsService().escalateAlert(id, session.workspace.id, session.membership.id);
  if (!result.success) return { success: false, error: result.error };
  recordAlertTransitionTimelineEvent(result.data);
  return { success: true, data: result.data };
}

export async function listOperationalIncidentsAction(includeResolved = false): Promise<ActionResult<OperationalIncident[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const incidents = await getCoreOperationalIncidentsService().listIncidentsForWorkspace(session.workspace.id, includeResolved);
  return { success: true, data: incidents };
}

export async function getOperationalIncidentAction(id: string): Promise<ActionResult<OperationalIncident>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const incident = await getCoreOperationalIncidentsService().getIncidentById(id);
  if (!incident || incident.workspace_id !== session.workspace.id) return { success: false, error: "This incident could not be found." };
  return { success: true, data: incident };
}

export async function setIncidentStatusAction(id: string, status: IncidentStatus, resolutionNotes?: string): Promise<ActionResult<OperationalIncident>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operations_incidents.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreOperationalIncidentsService().setIncidentStatus(id, session.workspace.id, status, resolutionNotes);
  if (!result.success) return { success: false, error: result.error };
  const timelineType = status === "acknowledged" ? "operational_incident_acknowledged" : status === "resolved" ? "operational_incident_resolved" : null;
  if (timelineType) recordTimelineActivity(result.data.workspace_id, "operational_incident", result.data.id, timelineType, `${status === "acknowledged" ? "Incident acknowledged" : "Incident resolved"}: ${result.data.title}`);
  return { success: true, data: result.data };
}
