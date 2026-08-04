"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCoreDecisionsService } from "@/core/executiveDecisions";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { readMediaAssets } from "@/lib/data/mock/mediaAssetsStore";
import { recordTimelineActivity, readActivities } from "@/lib/data/mock/timelineStore";
import { getDocuments, getMediaFolders } from "@/lib/data";
import { computeKnowledgeHealth } from "@/core/knowledge/knowledgeHealthEngine";
import { computeBusinessRuleViolations } from "@/core/knowledge/businessRuleEngine";
import { recommendationsFromViolations } from "@/core/knowledge/operationalRecommendationEngine";
import { generateDecisionDrafts, type RecommendationSource } from "@/core/executiveDecisions/executiveDecisionEngine";
import { computePriority, type DecisionFactors } from "@/core/executiveDecisions/priorityEngine";
import { computeDecisionScores } from "@/core/executiveDecisions/decisionScoringEngine";
import { evaluateDecisionDependencies, validateDecisionStatusTransition, deriveDecisionAgeDays, resolveDecisionReadiness, type DecisionDependencyContext, type ReadinessLookupContext } from "@/core/executiveDecisions/decisionEngine";
import { decisionStatusTimelineEvent, decisionPriorityTimelineEvent, type DecisionTimelineEvent } from "@/core/executiveDecisions/executiveTimelineEngine";
import { shouldEscalate } from "@/core/executiveDecisions/escalationEngine";
import { buildExecutiveQueue } from "@/core/executiveDecisions/executiveQueueEngine";
import { computeExecutiveScorecard } from "@/core/executiveDecisions/executiveScorecardEngine";
import { computeExecutiveInsights } from "@/core/executiveDecisions/executiveInsightsEngine";
import { generateExecutiveReport } from "@/core/executiveDecisions/executiveReportEngine";
import { evaluateBusinessHealthAction } from "@/modules/knowledgeGraph/businessHealthActions";
import { evaluateObjectivesAction } from "@/modules/objectives/objectivesActions";
import { evaluateWorkforceCapabilityCoverageAction } from "@/modules/capability/capabilityActions";
import { capabilityRisksToRecommendations } from "@/core/capability/capabilityFindingsEngine";
import { schedulingRecommendationsForExecutiveDecisions } from "@/modules/scheduling/schedulingActions";
import { allocationRecommendationsForExecutiveDecisions } from "@/modules/allocation/allocationActions";
import { operationalPlanningRecommendationsForExecutiveDecisions } from "@/modules/operationalPlanning/operationalPlanningActions";
import { executionPackageRecommendationsForExecutiveDecisions } from "@/modules/executionPackage/executionPackageActions";
import { dispatchRecommendationsForExecutiveDecisions } from "@/modules/dispatch/dispatchActions";
import { fieldOperationsRecommendationsForExecutiveDecisions } from "@/modules/fieldOperations/fieldOperationsActions";
import { routeOptimizationRecommendationsForExecutiveDecisions } from "@/modules/routeOptimization/routeOptimizationActions";
import { journeyRecommendationsForExecutiveDecisions } from "@/modules/clientJourney/clientJourneyActions";
import { proposalRecommendationsForExecutiveDecisions } from "@/modules/proposalPlatform/proposalPlatformActions";
import { contractRecommendationsForExecutiveDecisions } from "@/modules/contractPlatform/contractPlatformActions";
import { invoiceRecommendationsForExecutiveDecisions } from "@/modules/invoicePlatform/invoicePlatformActions";
import { clientPortalRecommendationsForExecutiveDecisions } from "@/modules/clientPortal/clientPortalExecutiveIntegration";
import { digitalAssetsRecommendationsForExecutiveDecisions } from "@/modules/digitalAssets/digitalAssetsActions";
import { workflowRecommendationsForExecutiveDecisions } from "@/modules/workflowMonitoring/workflowMonitoringActions";
import { searchRecommendationsForExecutiveDecisions } from "@/modules/search/searchActions";
import { notificationRecommendationsForExecutiveDecisions } from "@/modules/notifications/notificationPlatformActions";
import { documentPlatformRecommendationsForExecutiveDecisionsAction } from "@/modules/documentTemplates/getDocumentHealthAction";
import { nowIso } from "@/lib/data/utils";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { Decision, DecisionScores, DecisionStatus, ExecutiveInsights, ExecutiveReport, WorkspaceExecutiveScorecard } from "@/types/executiveDecisions";
import type { ObjectiveStatus } from "@/types/objectives";

const GENERIC_ACCESS_ERROR = "Executive Decisions aren't available. You may not have access to them.";
const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);
/** The four node types `businessHealthActions.ts`'s readiness sweep already covers — a Business Rule Violation on one of these is already folded into that recommendation, via `recommendationsFromViolations`, so it must not also be drafted a second time here under `"business_rule_engine"`. */
const READINESS_SWEPT_NODE_TYPES = new Set(["proposal", "event", "client", "vendor"]);

/**
 * v2.0 Checkpoint 25.7 — the module layer every engine in
 * `core/executiveDecisions/` is fed through. Mirrors `businessHealthActions.ts`/
 * `objectivesActions.ts`'s own shape: resolve the session once, fetch every
 * dependency exactly once, feed the pure engines, record Timeline
 * transitions, return the result. Calls `evaluateBusinessHealthAction()`
 * and `evaluateObjectivesAction()` directly — genuine reuse of both prior
 * checkpoints' whole orchestrators, not a recomputation of either.
 */

function recordDecisionTimelineEvent(workspaceId: string, node: KnowledgeNodeRef | null, event: DecisionTimelineEvent | null): void {
  if (!event) return;
  const ownerType = node?.nodeType ?? "workspace";
  const ownerId = node?.nodeId ?? workspaceId;
  if (!ENTITY_TYPE_SET.has(ownerType)) return;
  recordTimelineActivity(workspaceId, ownerType as EntityType, ownerId, event.type, event.description);
}

export interface EvaluateExecutiveDecisionsResult {
  queue: Decision[];
  allDecisions: Decision[];
  decisionScores: Record<string, DecisionScores>;
  resolvedDecisions: Decision[];
  blockedDecisions: Decision[];
  scorecard: WorkspaceExecutiveScorecard;
  insights: ExecutiveInsights;
  report: ExecutiveReport;
}

export async function evaluateExecutiveDecisionsAction(): Promise<{ success: true; data: EvaluateExecutiveDecisionsResult } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const now = nowIso();

  const [relationships, documents, folders, businessHealthResult, objectivesResult, capabilityCoverageResult, schedulingRecommendations, allocationRecommendations, operationalPlanningRecommendations, executionPackageRecommendations, dispatchRecommendations, fieldOperationsRecommendations, routeOptimizationRecommendations, journeyRecommendations, proposalRecommendations, contractRecommendations, invoiceRecommendations, clientPortalRecommendations, digitalAssetsRecommendations, workflowRecommendations, searchRecommendations, notificationRecommendations, documentPlatformRecommendations] = await Promise.all([
    getCoreKnowledgeGraphService().listRelationshipsForWorkspace(workspaceId, true),
    getDocuments({ includeArchived: true, latestVersionOnly: true }).catch(() => []),
    getMediaFolders().catch(() => []),
    evaluateBusinessHealthAction(),
    evaluateObjectivesAction(),
    evaluateWorkforceCapabilityCoverageAction(),
    // v2.0 Checkpoint 27 — Enterprise Scheduling Platform. Additive, same as Capability: a workspace with no calendars/appointments simply contributes zero findings, it never blocks Executive Decision evaluation.
    schedulingRecommendationsForExecutiveDecisions(),
    // v2.0 Checkpoint 27.1 — Resource Allocation Platform. Additive, same as Scheduling: a workspace with no allocation requests simply contributes zero findings, it never blocks Executive Decision evaluation.
    allocationRecommendationsForExecutiveDecisions(),
    // v2.0 Checkpoint 27.2 — Operational Planning Platform. Additive, same as Allocation: a workspace with no operational plans simply contributes zero findings, it never blocks Executive Decision evaluation.
    operationalPlanningRecommendationsForExecutiveDecisions(),
    // v2.0 Checkpoint 27.3 — Execution Package Platform. Additive, same as Operational Planning: a workspace with no execution packages simply contributes zero findings, it never blocks Executive Decision evaluation.
    executionPackageRecommendationsForExecutiveDecisions(),
    // v2.0 Checkpoint 28 — Dispatch Platform. Additive, same as Execution Package: a workspace with no dispatch orders simply contributes zero findings, it never blocks Executive Decision evaluation.
    dispatchRecommendationsForExecutiveDecisions(),
    // v2.0 Checkpoint 29 — Field Operations Platform. Additive, same as Dispatch: a workspace with no field operations simply contributes zero findings, it never blocks Executive Decision evaluation.
    fieldOperationsRecommendationsForExecutiveDecisions(),
    // v2.0 Checkpoint 30 — Route Optimization Platform. Additive, same as Field Operations: a workspace with no route plans simply contributes zero findings, it never blocks Executive Decision evaluation.
    routeOptimizationRecommendationsForExecutiveDecisions(),
    // v2.0 Checkpoint 32 — Client Journey & CRM Experience Platform. Additive, same as Route Optimization: a workspace with no active journeys simply contributes zero findings, it never blocks Executive Decision evaluation.
    journeyRecommendationsForExecutiveDecisions(),
    // v2.0 Checkpoint 33 — Proposal & Quote Platform. Additive, same as Client Journey: a workspace with no proposals simply contributes zero findings, it never blocks Executive Decision evaluation.
    proposalRecommendationsForExecutiveDecisions(),
    // v2.0 Checkpoint 34 — Contract Management Platform. Additive, same as Proposal: a workspace with no contract documents simply contributes zero findings, it never blocks Executive Decision evaluation.
    contractRecommendationsForExecutiveDecisions(),
    // v2.0 Checkpoint 35 — Invoice & Billing Platform. Additive, same as Contract: a workspace with no invoices simply contributes zero findings, it never blocks Executive Decision evaluation. (Built alongside `invoiceExecutiveIntegration.ts` in Checkpoint 35 but never wired into this Promise.all until Checkpoint 36 Step 15's own audit found the gap.)
    invoiceRecommendationsForExecutiveDecisions(),
    // Checkpoint 36 — Unified Client Portal, Step 15. Additive, same shape as every platform above: a workspace with no pending client-initiated revision requests simply contributes zero findings, it never blocks Executive Decision evaluation.
    clientPortalRecommendationsForExecutiveDecisions(),
    // Checkpoint 37 — Digital Asset Management Platform, Step 14. Additive, same shape as every platform above: a workspace with no unhealthy assets simply contributes zero findings, it never blocks Executive Decision evaluation.
    digitalAssetsRecommendationsForExecutiveDecisions(),
    // v2.0 Checkpoint 39 — Workflow Monitoring Center. Additive, same shape as every platform above: a workspace with no workflows simply contributes zero findings, it never blocks Executive Decision evaluation.
    workflowRecommendationsForExecutiveDecisions(),
    // v2.0 Checkpoint 40 — Global Search & Universal Command Center. Additive, same shape as every platform above: a workspace with fully-covered, healthy Search simply contributes zero findings, it never blocks Executive Decision evaluation.
    searchRecommendationsForExecutiveDecisions(),
    // v2.0 Checkpoint 41 — Notification Center. Additive, same shape as every platform above: a workspace with healthy Notification delivery/routing/preferences/configuration simply contributes zero findings, it never blocks Executive Decision evaluation.
    notificationRecommendationsForExecutiveDecisions(),
    // v2 Checkpoint 44 — Client Documents & Digital Client Experience. Additive, same shape as every platform above: a workspace with no unhealthy Documents/Document Bundles simply contributes zero findings, it never blocks Executive Decision evaluation.
    documentPlatformRecommendationsForExecutiveDecisionsAction(),
  ]);
  const assets = readMediaAssets().filter((a) => a.workspace_id === workspaceId);

  if (!businessHealthResult.success) return { success: false, error: businessHealthResult.error };
  if (!objectivesResult.success) return { success: false, error: objectivesResult.error };
  // Checkpoint 26.1's Capability Platform is additive — a workspace with no saved Capability Requirements (or one this caller can't evaluate for any reason) simply contributes zero findings, it never blocks Executive Decision evaluation.
  const capabilityRisks = capabilityCoverageResult.success ? capabilityCoverageResult.data.risks : [];
  const capabilityRequirements = capabilityCoverageResult.success ? capabilityCoverageResult.data.evaluationResults.map((r) => r.requirement) : [];

  const existingNodeKeys = new Set(assets.map((a) => `${a.owner_type}:${a.owner_id}`));
  const nodeMap = new Map<string, KnowledgeNodeRef>();
  for (const r of relationships) {
    nodeMap.set(`${r.source_node_type}:${r.source_node_id}`, { nodeType: r.source_node_type, nodeId: r.source_node_id });
    nodeMap.set(`${r.target_node_type}:${r.target_node_id}`, { nodeType: r.target_node_type, nodeId: r.target_node_id });
  }
  const nodesToValidate = Array.from(nodeMap.values());

  const knowledgeHealth = computeKnowledgeHealth({ assets, relationships, existingNodeKeys, nodesToValidate });
  const businessRuleViolations = computeBusinessRuleViolations({ nodesToValidate, relationships, folders });
  const expiredDocuments = documents.filter((d) => d.expires_at !== null && new Date(d.expires_at).getTime() < new Date(now).getTime());

  const readinessScores = [...businessHealthResult.data.proposalReadiness, ...businessHealthResult.data.eventReadiness, ...businessHealthResult.data.clientReadiness, ...businessHealthResult.data.vendorReadiness];

  const recommendationSources: RecommendationSource[] = [
    { generatedBy: "business_health_engine", recommendations: readinessScores.flatMap((r) => r.suggestedNextSteps) },
    ...objectivesResult.data.evaluations.map((e) => ({ generatedBy: "objective_health_engine", recommendations: e.health.recommendations, relatedObjectiveId: e.objective.id })),
    { generatedBy: "business_rule_engine", recommendations: recommendationsFromViolations(businessRuleViolations.filter((v) => !READINESS_SWEPT_NODE_TYPES.has(v.node.nodeType))) },
    // v2.0 Checkpoint 26.1 — Workforce Capability & Eligibility Platform. Translates `WorkforceRisk[]` (already computed by `capabilityRiskEngine.ts`) through the exact same `RecommendationSource` contract every other source here uses — never a second recommendation/decision engine.
    { generatedBy: "workforce_capability_engine", recommendations: capabilityRisksToRecommendations(capabilityRisks, capabilityRequirements, workspaceId) },
    // v2.0 Checkpoint 27 — Enterprise Scheduling Platform. `schedulingRecommendationsForExecutiveDecisions()` already translated `SchedulingFinding[]` via `schedulingFindingsEngine.ts` — this file detects nothing new.
    { generatedBy: "scheduling_engine", recommendations: schedulingRecommendations },
    // v2.0 Checkpoint 27.1 — Resource Allocation Platform. `allocationRecommendationsForExecutiveDecisions()` already translated `AllocationFinding[]` via `allocationFindingsEngine.ts` — this file detects nothing new.
    { generatedBy: "allocation_engine", recommendations: allocationRecommendations },
    // v2.0 Checkpoint 27.2 — Operational Planning Platform. `operationalPlanningRecommendationsForExecutiveDecisions()` already translated `OperationalFinding[]` via `operationalFindingsEngine.ts` — this file detects nothing new.
    { generatedBy: "operational_planning_engine", recommendations: operationalPlanningRecommendations },
    // v2.0 Checkpoint 27.3 — Execution Package Platform. `executionPackageRecommendationsForExecutiveDecisions()` already translated `PackageFinding[]` via `executionPackageFindingsEngine.ts` — this file detects nothing new.
    { generatedBy: "execution_package_engine", recommendations: executionPackageRecommendations },
    // v2.0 Checkpoint 28 — Dispatch Platform. `dispatchRecommendationsForExecutiveDecisions()` already translated `DispatchFinding[]` via `dispatchFindingsEngine.ts` — this file detects nothing new.
    { generatedBy: "dispatch_engine", recommendations: dispatchRecommendations },
    // v2.0 Checkpoint 29 — Field Operations Platform. `fieldOperationsRecommendationsForExecutiveDecisions()` already translated `FieldOperationFinding[]` via `fieldOperationFindingsEngine.ts` — this file detects nothing new.
    { generatedBy: "field_operations_engine", recommendations: fieldOperationsRecommendations },
    // v2.0 Checkpoint 30 — Route Optimization Platform. `routeOptimizationRecommendationsForExecutiveDecisions()` already translated `RouteFinding[]` via `routeFindingsEngine.ts` — this file detects nothing new.
    { generatedBy: "route_optimization_engine", recommendations: routeOptimizationRecommendations },
    // v2.0 Checkpoint 32 — Client Journey & CRM Experience Platform. `journeyRecommendationsForExecutiveDecisions()` already translated Journey Blockers/Risks via `journeyExecutiveIntegration.ts` — this file detects nothing new.
    { generatedBy: "client_journey_engine", recommendations: journeyRecommendations },
    // v2.0 Checkpoint 33 — Proposal & Quote Platform. `proposalRecommendationsForExecutiveDecisions()` already translated Proposal Health/Readiness findings via `proposalExecutiveIntegration.ts` — this file detects nothing new.
    { generatedBy: "proposal_platform_engine", recommendations: proposalRecommendations },
    // v2.0 Checkpoint 34 — Contract Management Platform. `contractRecommendationsForExecutiveDecisions()` already translated Contract Health/Readiness findings (plus the cross-workspace "accepted Proposal missing a Contract" check) via `contractExecutiveIntegration.ts` — this file detects nothing new.
    { generatedBy: "contract_platform_engine", recommendations: contractRecommendations },
    // v2.0 Checkpoint 35 — Invoice & Billing Platform. `invoiceRecommendationsForExecutiveDecisions()` already translated Invoice Health/Readiness findings via `invoiceExecutiveIntegration.ts` — this file detects nothing new.
    { generatedBy: "invoice_platform_engine", recommendations: invoiceRecommendations },
    // Checkpoint 36 — Unified Client Portal, Step 15. `clientPortalRecommendationsForExecutiveDecisions()` already translated pending client revision requests via `clientPortalExecutiveIntegration.ts` — this file detects nothing new.
    { generatedBy: "client_portal_engine", recommendations: clientPortalRecommendations },
    // Checkpoint 37 — Digital Asset Management Platform, Step 14. `digitalAssetsRecommendationsForExecutiveDecisions()` already translated Asset Health Engine findings via `core/digitalAssets/executiveIntegration.ts` — this file detects nothing new.
    { generatedBy: "digital_assets_engine", recommendations: digitalAssetsRecommendations },
    // v2.0 Checkpoint 39 — Workflow Monitoring Center. `workflowRecommendationsForExecutiveDecisions()` already translated Workflow Health Engine findings via `core/workflowMonitoring/executiveIntegration.ts` — this file detects nothing new.
    { generatedBy: "workflow_health_engine", recommendations: workflowRecommendations },
    // v2.0 Checkpoint 40 — Global Search & Universal Command Center. `searchRecommendationsForExecutiveDecisions()` already translated Search Health Engine findings via `core/search/executiveIntegration.ts` — this file detects nothing new.
    { generatedBy: "search_health_engine", recommendations: searchRecommendations },
    // v2.0 Checkpoint 41 — Notification Center. `notificationRecommendationsForExecutiveDecisions()` already translated Notification Health Engine findings via `core/notifications/executiveIntegration.ts` — this file detects nothing new.
    { generatedBy: "notification_health_engine", recommendations: notificationRecommendations },
    // v2 Checkpoint 44 — Client Documents & Digital Client Experience. `documentPlatformRecommendationsForExecutiveDecisionsAction()` already translated Document Health Engine findings via `core/documents/executiveIntegration.ts` — this file detects nothing new.
    { generatedBy: "document_platform_engine", recommendations: documentPlatformRecommendations },
  ];

  const drafts = generateDecisionDrafts({
    recommendationSources,
    brokenRelationships: knowledgeHealth.brokenRelationships,
    duplicateRelationshipGroups: knowledgeHealth.duplicateRelationshipGroups,
    circularReferenceGroups: knowledgeHealth.circularReferenceGroups,
    expiredDocuments,
  });

  const preExistingDecisionIds = new Set((await getCoreDecisionsService().listDecisionsForWorkspace(workspaceId, true)).map((d) => d.id));
  for (const draft of drafts) {
    const result = await getCoreDecisionsService().upsertDecision(workspaceId, draft);
    if (result.success && !preExistingDecisionIds.has(result.data.id)) {
      recordDecisionTimelineEvent(workspaceId, result.data.related_entities[0] ?? null, decisionStatusTimelineEvent(null, result.data.status, result.data.title));
    }
  }

  const allDecisionsBeforeRefresh = await getCoreDecisionsService().listDecisionsForWorkspace(workspaceId, true);
  const decisionStatusById = new Map(allDecisionsBeforeRefresh.map((d) => [d.id, d.status] as const));
  const objectiveStatusById = new Map(objectivesResult.data.evaluations.map((e) => [e.objective.id, e.objective.status] as const));
  const activeRelationshipIds = new Set(relationships.filter((r) => r.status === "active").map((r) => r.id));
  const existingTimelineActivityIds = new Set(readActivities().map((a) => a.id));

  // v2.0 Checkpoint 25.7 Closing Fix — every lookup here is an already-computed value from
  // `evaluateBusinessHealthAction()`/`evaluateObjectivesAction()`, never a new readiness calculation.
  const readinessLookupContext: ReadinessLookupContext = {
    proposalReadinessByNodeId: new Map(businessHealthResult.data.proposalReadiness.map((r) => [r.node.nodeId, r.overallScore])),
    eventReadinessByNodeId: new Map(businessHealthResult.data.eventReadiness.map((r) => [r.node.nodeId, r.overallScore])),
    clientReadinessByNodeId: new Map(businessHealthResult.data.clientReadiness.map((r) => [r.node.nodeId, r.overallScore])),
    vendorReadinessByNodeId: new Map(businessHealthResult.data.vendorReadiness.map((r) => [r.node.nodeId, r.overallScore])),
    objectiveProgressById: new Map(objectivesResult.data.evaluations.map((e) => [e.objective.id, e.progress.completionPercent] as const)),
    businessHealthOverallScore: businessHealthResult.data.businessHealth.overallScore,
  };

  interface DecisionRefresh {
    decision: Decision;
    scores: DecisionScores;
    newPriority: Decision["priority"];
    unmetDependencyCount: number;
    ageDays: number;
    relatedObjectiveStatuses: ObjectiveStatus[];
  }

  const refreshes: DecisionRefresh[] = [];
  for (const decision of allDecisionsBeforeRefresh) {
    if (decision.status === "resolved" || decision.status === "archived") continue;

    const ageDays = deriveDecisionAgeDays(decision.created_at, now);
    const dependencyContext: DecisionDependencyContext = {
      decisionStatusById,
      objectiveStatusById,
      // Same narrower "Media Asset owner references only" existingNodeKeys convention `businessHealthActions.ts` uses — `generateDecisionDrafts` never attaches dependencies to a freshly-generated draft, so this only matters for a Decision a caller has manually attached dependencies to.
      existingNodeKeys,
      activeRelationshipIds,
      existingTimelineActivityIds,
      businessRuleViolations,
      approvalFlags: {},
    };
    const dependencyEvaluations = evaluateDecisionDependencies(decision.dependencies, dependencyContext);
    const unmetDependencyCount = dependencyEvaluations.filter((e) => !e.satisfied).length;
    const relatedObjectiveStatuses = decision.related_objective_ids.map((id) => objectiveStatusById.get(id)).filter((s): s is ObjectiveStatus => s !== undefined);
    const readiness = resolveDecisionReadiness(decision, readinessLookupContext);

    const factors: DecisionFactors = {
      businessImpactCount: decision.related_entities.length,
      dependencyCount: decision.dependencies.length,
      unmetDependencyCount,
      blockingRelationshipsCount: /broken_relationship|circular_reference|duplicate_relationship_group/.test(decision.reason) ? 1 : 0,
      operationalReadiness: readiness.value,
      objectiveBlocked: relatedObjectiveStatuses.includes("blocked"),
      businessRuleSeverity: decision.category === "compliance" ? "hard" : null,
      ageDays,
      riskFlag: decision.category === "compliance" || decision.category === "security",
    };

    refreshes.push({ decision, scores: computeDecisionScores(factors, readiness), newPriority: computePriority(factors), unmetDependencyCount, ageDays, relatedObjectiveStatuses });
  }

  for (const r of refreshes) {
    if (r.newPriority !== r.decision.priority) {
      await getCoreDecisionsService().setDecisionPriority(r.decision.id, workspaceId, r.newPriority);
      recordDecisionTimelineEvent(workspaceId, r.decision.related_entities[0] ?? null, decisionPriorityTimelineEvent(r.decision.priority, r.newPriority, r.decision.title));
    }
    if (r.decision.status !== "escalated" && shouldEscalate({ ...r.decision, priority: r.newPriority }, { ageDays: r.ageDays, relatedObjectiveStatuses: r.relatedObjectiveStatuses, unmetDependencyCount: r.unmetDependencyCount })) {
      await getCoreDecisionsService().setDecisionStatus(r.decision.id, workspaceId, "escalated", null);
      recordDecisionTimelineEvent(workspaceId, r.decision.related_entities[0] ?? null, decisionStatusTimelineEvent(r.decision.status, "escalated", r.decision.title));
    }
  }

  const allDecisions = await getCoreDecisionsService().listDecisionsForWorkspace(workspaceId, true);
  const decisionScoresById = new Map(refreshes.map((r) => [r.decision.id, r.scores]));
  const resolvedDecisions = allDecisions.filter((d) => d.status === "resolved");
  const blockedDecisions = refreshes.filter((r) => r.unmetDependencyCount > 0).map((r) => allDecisions.find((d) => d.id === r.decision.id)).filter((d): d is Decision => d !== undefined);
  const queue = buildExecutiveQueue(allDecisions, decisionScoresById);

  const insights = computeExecutiveInsights({
    decisions: allDecisions,
    objectiveEvaluations: objectivesResult.data.evaluations.map((e) => ({ objective: e.objective, health: e.health })),
    relationships,
    businessRuleViolations,
  });

  const knowledgeHealthCategoryScore = businessHealthResult.data.businessHealth.categories.find((c) => c.category === "knowledge_health")?.score ?? null;
  const scorecard = computeExecutiveScorecard({
    businessHealthOverallScore: businessHealthResult.data.businessHealth.overallScore,
    knowledgeHealthCategoryScore,
    objectiveOverallOperationalScore: objectivesResult.data.scorecard.overallOperationalScore,
    operationalProgress: objectivesResult.data.scorecard.operationalProgress,
    readinessScores: readinessScores.map((r) => r.overallScore),
    openDecisionScores: refreshes.map((r) => r.scores.decisionScore),
    evaluatedAt: now,
  });

  const report = generateExecutiveReport({ scorecard, queue, resolvedDecisions, blockedDecisions, insights, evaluatedAt: now });

  return {
    success: true,
    data: { queue, allDecisions, decisionScores: Object.fromEntries(decisionScoresById), resolvedDecisions, blockedDecisions, scorecard, insights, report },
  };
}

export async function updateDecisionStatusAction(decisionId: string, nextStatus: DecisionStatus, resolutionNotes: string | null = null): Promise<{ success: true; data: Decision } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("executive_decisions.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const decision = await getCoreDecisionsService().getDecisionById(decisionId);
  if (!decision || decision.workspace_id !== workspaceId) return { success: false, error: "This decision could not be found." };

  const allDecisions = await getCoreDecisionsService().listDecisionsForWorkspace(workspaceId, true);
  const decisionStatusById = new Map(allDecisions.map((d) => [d.id, d.status] as const));
  const objectivesResult = await evaluateObjectivesAction();
  const objectiveStatusById = new Map(objectivesResult.success ? objectivesResult.data.evaluations.map((e) => [e.objective.id, e.objective.status] as const) : []);

  const dependencyEvaluations = evaluateDecisionDependencies(decision.dependencies, {
    decisionStatusById,
    objectiveStatusById,
    existingNodeKeys: new Set(readMediaAssets().map((a) => `${a.owner_type}:${a.owner_id}`)),
    activeRelationshipIds: new Set((await getCoreKnowledgeGraphService().listRelationshipsForWorkspace(workspaceId, false)).map((r) => r.id)),
    existingTimelineActivityIds: new Set(readActivities().map((a) => a.id)),
    businessRuleViolations: [],
    approvalFlags: {},
  });
  const check = validateDecisionStatusTransition(nextStatus, dependencyEvaluations);
  if (!check.allowed) return { success: false, error: check.blockingReasons.join(" ") };

  const result = await getCoreDecisionsService().setDecisionStatus(decisionId, workspaceId, nextStatus, resolutionNotes);
  if (!result.success) return { success: false, error: result.error };

  recordDecisionTimelineEvent(workspaceId, decision.related_entities[0] ?? null, decisionStatusTimelineEvent(decision.status, nextStatus, decision.title));
  return { success: true, data: result.data };
}
