"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { readMediaAssets } from "@/lib/data/mock/mediaAssetsStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import {
  getEvents,
  getClients,
  getVendors,
  getContracts,
  getInvoices,
  getDocuments,
  getMediaFolders,
  getScheduleByEventId,
  getChecklistByEventId,
  listEventServicesByEvent,
  listEventServiceVendorAssignments,
  getWorkspaceMembers,
} from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import { computeKnowledgeHealth } from "@/core/knowledge/knowledgeHealthEngine";
import { computeWorkspaceHealth } from "@/core/knowledge/workspaceHealthEngine";
import { computeBusinessHealth } from "@/core/knowledge/businessHealthEngine";
import { computeReadinessScore } from "@/core/knowledge/readinessEngine";
import { computeBusinessRuleViolations } from "@/core/knowledge/businessRuleEngine";
import { getWorkflowManager } from "@/core/workflow/manager";
import { getAutomationManager } from "@/core/automation/manager";
import { listAutomations } from "@/core/automation/registry";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import { computeWorkspaceWorkflowHealth } from "@/core/workflowMonitoring/healthEngine";
import { buildWorkflowExecutionSummaries } from "@/core/workflowMonitoring/executionSummary";
import { computeSearchHealth } from "@/core/search/searchHealthEngine";
import { computeNotificationHealth } from "@/core/notifications/notificationHealthEngine";
import { getDocumentsManager } from "@/core/documents/manager";
import { resolveBundleItems } from "@/core/documents/bundleResolver";
import { computeComposedDocumentHealth, computeDocumentBundleHealth, summarizeDocumentPlatformHealth } from "@/core/documents/documentHealthEngine";
import { getCoreNotificationsService, listNotificationTemplates } from "@/core/notifications";
import { countConfiguredPreferences } from "@/lib/data/core/communication/notificationPreferencesStore";
import { getSettingsManager } from "@/core/settings/manager";
import { notificationsSettings } from "@/modules/settings/sections/notificationsSection";
import {
  evaluateProposalCompleteness,
  evaluateEventCompleteness,
  evaluateClientCompleteness,
  evaluateVendorCompleteness,
} from "@/core/knowledge/completenessEngine";
import {
  diffBusinessHealth,
  diffReadiness,
  diffConstraintViolations,
  diffCriticalDependencies,
  type OperationalTimelineEvent,
} from "@/core/knowledge/operationalTimelineEngine";
import {
  getBusinessHealthSnapshot,
  setBusinessHealthSnapshot,
  getReadinessSnapshot,
  setReadinessSnapshot,
  getLastConstraintViolations,
  setLastConstraintViolations,
  getLastBusinessRuleViolations,
  setLastBusinessRuleViolations,
} from "@/lib/data/mock/businessHealthSnapshotsStore";
import { nowIso } from "@/lib/data/utils";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { BusinessHealthReport, ReadinessScore } from "@/types/businessHealth";

const GENERIC_ACCESS_ERROR = "Business Health isn't available. You may not have access to it.";
const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);

export interface BusinessHealthEvaluation {
  businessHealth: BusinessHealthReport;
  proposalReadiness: ReadinessScore[];
  eventReadiness: ReadinessScore[];
  clientReadiness: ReadinessScore[];
  vendorReadiness: ReadinessScore[];
}

export type EvaluateBusinessHealthResult = { success: true; data: BusinessHealthEvaluation } | { success: false; error: string };

/** Same "not every node type owns a Timeline" guard `recordGraphTimelineEvent` (Step 13) already established — an operational event on a node type outside `EntityType` (there are none among the four this action evaluates, but the diff engine is generic) simply has no Timeline entry, never a thrown error. */
function recordOperationalTimelineEvent(workspaceId: string, event: OperationalTimelineEvent): void {
  if (!ENTITY_TYPE_SET.has(event.node.nodeType)) return;
  recordTimelineActivity(workspaceId, event.node.nodeType as EntityType, event.node.nodeId, event.type, event.description);
}

/**
 * v2.0 Checkpoint 25, Step 15.5 — the single real caller of every engine
 * this checkpoint built (`completenessEngine`, `relationshipConstraintsEngine`,
 * `businessRuleEngine`, `knowledgeHealthEngine`, `workspaceHealthEngine`,
 * `businessHealthEngine`, `readinessEngine`, `operationalTimelineEngine`).
 * It fetches data exactly once, feeds every engine, diffs the result
 * against the workspace's last evaluation (`businessHealthSnapshotsStore.ts`),
 * records the Timeline events that diff produced, and persists the new
 * snapshot for next time. Readiness is evaluated for Proposal/Event/
 * Client/Vendor — the four node types `completenessEngine.ts` has a real
 * evaluator for; Invoice/Workspace/Asset/Collection readiness (constraint-
 * only, per `readinessEngine.ts`'s own doc comment) is available on demand
 * from `computeReadinessScore` directly but isn't part of this bulk sweep,
 * to avoid an O(assets) scan on every dashboard load.
 */
export async function evaluateBusinessHealthAction(): Promise<EvaluateBusinessHealthResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const now = nowIso();

  const [relationships, events, clients, vendors, contracts, invoices, documents, folders] = await Promise.all([
    getCoreKnowledgeGraphService().listRelationshipsForWorkspace(workspaceId, true),
    getEvents({ includeArchived: false }),
    getClients({}),
    getVendors({}),
    getContracts({ includeArchived: true }),
    getInvoices({ includeArchived: true }),
    getDocuments({ includeArchived: true, latestVersionOnly: true }),
    getMediaFolders(),
  ]);
  const assets = readMediaAssets().filter((a) => a.workspace_id === workspaceId);

  const proposalsByEvent = await Promise.all(events.map((event) => getProposalsRepository().getProposalsByEvent(event.id)));
  const proposals = proposalsByEvent.flat();

  const existingNodeKeys = new Set(assets.map((a) => `${a.owner_type}:${a.owner_id}`));
  const nodeMap = new Map<string, KnowledgeNodeRef>();
  for (const r of relationships) {
    nodeMap.set(`${r.source_node_type}:${r.source_node_id}`, { nodeType: r.source_node_type, nodeId: r.source_node_id });
    nodeMap.set(`${r.target_node_type}:${r.target_node_id}`, { nodeType: r.target_node_type, nodeId: r.target_node_id });
  }
  const nodesToValidate = Array.from(nodeMap.values());

  const knowledgeHealth = computeKnowledgeHealth({ assets, relationships, existingNodeKeys, nodesToValidate });

  const proposalCompleteness = proposals.map((proposal) =>
    evaluateProposalCompleteness({
      proposal,
      relationships,
      documents: documents.filter((d) => d.owner_type === "proposal" && d.owner_id === proposal.id),
    }),
  );

  const eventCompletenessInputs = await Promise.all(
    events.map(async (event) => {
      const [scheduleItems, checklistItems, services] = await Promise.all([
        getScheduleByEventId(event.id),
        getChecklistByEventId(event.id),
        listEventServicesByEvent(event.id),
      ]);
      const vendorAssignmentLists = await Promise.all(services.map((service) => listEventServiceVendorAssignments(service.id)));
      return {
        event,
        scheduleItems,
        checklistItems,
        vendorAssignments: vendorAssignmentLists.flat(),
        invoices: invoices.filter((i) => i.event_id === event.id),
        assets: assets.filter((a) => a.owner_type === "event" && a.owner_id === event.id),
      };
    }),
  );
  const eventCompleteness = eventCompletenessInputs.map((input) => evaluateEventCompleteness(input));

  const clientCompleteness = clients.map((client) =>
    evaluateClientCompleteness({
      client,
      contracts: contracts.filter((c) => c.client_id === client.id),
      documents: documents.filter((d) => d.owner_type === "client" && d.owner_id === client.id),
    }),
  );

  const vendorCompleteness = vendors.map((vendor) => evaluateVendorCompleteness({ vendor }));

  const workspaceHealth = computeWorkspaceHealth({
    assets,
    relationships,
    existingNodeKeys,
    nodesToValidate,
    documents,
    proposalCompleteness,
    eventCompleteness,
    proposals: proposals.map((p) => ({ status: p.status, reviewed_at: p.reviewed_at, generated_at: p.generated_at })),
    now,
  });

  // v2.0 Checkpoint 39 — Workflow Health, composed into the `workflow_readiness`
  // category `computeBusinessHealth` already reserves for it (see that engine's
  // own doc comment). Reuses the real Workflow store + Automation History; never
  // a second health calculation.
  const [workflows, workflowExecutions] = await Promise.all([getWorkflowManager().listWorkflows(workspaceId), getAutomationManager().getRecentExecutions(workspaceId, 500)]);
  const automations = listAutomations();
  const usedWorkflowIds = new Set(
    buildWorkflowExecutionSummaries(workflowExecutions, automations)
      .map((summary) => summary.workflowId)
      .filter((id): id is string => id !== null),
  );
  const disabledWorkflowIds = new Set(
    (
      await Promise.all(
        workflows
          .filter((workflow) => workflow.executionPolicy.featureFlag !== null)
          .map(async (workflow) => ({ id: workflow.id, enabled: await evaluateFeatureFlag(workspaceId, workflow.executionPolicy.featureFlag!) })),
      )
    )
      .filter((entry) => !entry.enabled)
      .map((entry) => entry.id),
  );
  const workflowHealth = computeWorkspaceWorkflowHealth(workflows, { usedWorkflowIds, disabledWorkflowIds }, now);

  // v2.0 Checkpoint 40 — Search Health, composed into the `search_health`
  // category `computeBusinessHealth` already reserves for it. Reuses the real
  // Search registry + active provider; never a second coverage calculation.
  const searchHealth = computeSearchHealth(now);

  // v2.0 Checkpoint 41 — Notification Health, composed into the
  // `communication_health` category `computeBusinessHealth` reserves for
  // it (previously always `notApplicable` — see that engine's own doc
  // comment). Reuses the real Notification store, Template Library, and
  // the workspace Settings registry; never a second coverage calculation.
  const [notificationsForWorkspace, workspaceMembers] = await Promise.all([
    getCoreNotificationsService().getMemberNotificationsForWorkspace(workspaceId),
    getWorkspaceMembers(),
  ]);
  const notificationTemplates = listNotificationTemplates(workspaceId);
  const configuredNotificationSettings = (
    await Promise.all(notificationsSettings.map((setting) => getSettingsManager().getSettingValue(workspaceId, setting.id)))
  ).filter((value) => value !== undefined).length;
  const notificationHealth = computeNotificationHealth({
    notifications: notificationsForWorkspace,
    templates: notificationTemplates,
    totalMembers: workspaceMembers.length,
    membersWithConfiguredPreferences: countConfiguredPreferences(workspaceId),
    configuredWorkspaceSettingsCount: configuredNotificationSettings,
    totalWorkspaceSettings: notificationsSettings.length,
    evaluatedAt: now,
  });

  // v2 Checkpoint 44 — Document Platform Health, composed into the
  // `document_platform_health` category `computeBusinessHealth` reserves
  // for it. Reuses the real Document Platform's own Health Engine
  // (`core/documents/documentHealthEngine.ts`, Step 12) over every
  // Composed Document/Bundle already fetched through `DocumentsManager` —
  // never a second read path or a recomputation of either engine.
  const documentsManager = getDocumentsManager();
  const [composedDocuments, documentBundles] = await Promise.all([
    documentsManager.listComposedDocuments(workspaceId),
    documentsManager.listDocumentBundlesForWorkspace(workspaceId),
  ]);
  const documentHealths = composedDocuments.map((document) => computeComposedDocumentHealth(document, now));
  const documentBundleHealths = await Promise.all(
    documentBundles.map(async (bundle) => computeDocumentBundleHealth(bundle, await resolveBundleItems(bundle.items), now)),
  );
  const documentPlatformHealth = summarizeDocumentPlatformHealth(documentHealths, documentBundleHealths);

  const businessHealth = computeBusinessHealth({
    knowledgeHealth,
    workspaceHealth,
    totalRelationships: relationships.filter((r) => r.status === "active").length,
    totalNodesValidated: nodesToValidate.length,
    totalAssets: assets.length,
    totalDocuments: documents.length,
    proposalCompleteness,
    clientCompleteness,
    eventCompleteness,
    vendorCompleteness,
    workflowHealth,
    searchHealth,
    notificationHealth,
    documentPlatformHealth,
    evaluatedAt: now,
  });

  const proposalReadiness = proposals.map((proposal, i) =>
    computeReadinessScore({ node: { nodeType: "proposal", nodeId: proposal.id }, relationships, completeness: proposalCompleteness[i], evaluatedAt: now }),
  );
  const eventReadiness = events.map((event, i) =>
    computeReadinessScore({ node: { nodeType: "event", nodeId: event.id }, relationships, completeness: eventCompleteness[i], evaluatedAt: now }),
  );
  const clientReadiness = clients.map((client, i) =>
    computeReadinessScore({ node: { nodeType: "client", nodeId: client.id }, relationships, completeness: clientCompleteness[i], evaluatedAt: now }),
  );
  const vendorReadiness = vendors.map((vendor, i) =>
    computeReadinessScore({ node: { nodeType: "vendor", nodeId: vendor.id }, relationships, completeness: vendorCompleteness[i], evaluatedAt: now }),
  );

  const businessRuleViolations = computeBusinessRuleViolations({ nodesToValidate, relationships, folders });

  // --- Diff against the workspace's last evaluation and record Timeline events. ---
  const previousHealthSnapshot = getBusinessHealthSnapshot(workspaceId);
  for (const event of diffBusinessHealth(workspaceId, previousHealthSnapshot, businessHealth)) {
    recordOperationalTimelineEvent(workspaceId, event);
  }
  setBusinessHealthSnapshot({ workspaceId, overallScore: businessHealth.overallScore, evaluatedAt: now });

  for (const score of [...proposalReadiness, ...eventReadiness, ...clientReadiness, ...vendorReadiness]) {
    const previousReadiness = getReadinessSnapshot(workspaceId, score.node.nodeType, score.node.nodeId);
    for (const event of diffReadiness(previousReadiness, score)) {
      recordOperationalTimelineEvent(workspaceId, event);
    }
    setReadinessSnapshot({ workspaceId, nodeType: score.node.nodeType, nodeId: score.node.nodeId, overallScore: score.overallScore, evaluatedAt: now });
  }

  const previousConstraintViolations = getLastConstraintViolations(workspaceId);
  for (const event of diffConstraintViolations(previousConstraintViolations, knowledgeHealth.constraintViolations)) {
    recordOperationalTimelineEvent(workspaceId, event);
  }
  setLastConstraintViolations(workspaceId, knowledgeHealth.constraintViolations);

  const previousBusinessRuleViolations = getLastBusinessRuleViolations(workspaceId);
  for (const event of diffCriticalDependencies(previousBusinessRuleViolations, businessRuleViolations)) {
    recordOperationalTimelineEvent(workspaceId, event);
  }
  setLastBusinessRuleViolations(workspaceId, businessRuleViolations);

  return { success: true, data: { businessHealth, proposalReadiness, eventReadiness, clientReadiness, vendorReadiness } };
}
