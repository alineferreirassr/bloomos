"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCoreObjectivesService, type CreateObjectiveInput } from "@/core/objectives";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { getCoreCommentsService } from "@/core/comments";
import { readMediaAssets } from "@/lib/data/mock/mediaAssetsStore";
import { recordTimelineActivity, readActivities } from "@/lib/data/mock/timelineStore";
import { getClients, getEvents, getContracts, getInvoices, getMediaFolders, getMediaCollections, getContract } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import { computeBusinessRuleViolations } from "@/core/knowledge/businessRuleEngine";
import { computeObjectiveProgress, type RequirementContext } from "@/core/objectives/progressEngine";
import { evaluateDependencies, validateStatusTransition, type DependencyContext } from "@/core/objectives/objectiveEngine";
import { computeObjectiveHealth } from "@/core/objectives/objectiveHealthEngine";
import { objectiveTimelineEventForTransition } from "@/core/objectives/objectiveTimelineEngine";
import { computeWorkspaceScorecard } from "@/core/objectives/scorecardEngine";
import { evaluateBusinessHealthAction } from "@/modules/knowledgeGraph/businessHealthActions";
import { nowIso } from "@/lib/data/utils";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import type { KnowledgeNodeRef, KnowledgeRelationship } from "@/types/knowledgeGraph";
import type { Objective, ObjectiveHealth, ObjectiveProgress, ObjectiveStatus, WorkspaceScorecard } from "@/types/objectives";
import type { BusinessRuleViolation } from "@/types/businessHealth";

const GENERIC_ACCESS_ERROR = "Objectives aren't available. You may not have access to them.";
const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);

/**
 * v2.0 Checkpoint 25, Step 15.6 — the module layer every engine in
 * `core/objectives/` is fed through. Mirrors `businessHealthActions.ts`'s
 * own shape exactly: resolve the session once, fetch every dependency
 * exactly once, feed the pure engines, record Timeline transitions,
 * return the result. `evaluateObjectivesAction` calls
 * `evaluateBusinessHealthAction()` directly for `businessReadiness` —
 * genuine reuse of the whole Step 15.5 orchestrator, not a recomputation.
 */

/** Only three approval concepts are wired up this checkpoint — an objective author can name any `approvalKey` string, but only these three ever resolve to `true`; anything else is a disclosed, honest `false` (unmet), never a guess. */
async function resolveApprovalFlags(node: KnowledgeNodeRef | null, mediaAssetStatus: string | null): Promise<Record<string, boolean>> {
  const flags: Record<string, boolean> = {};
  if (!node) return flags;

  if (node.nodeType === "proposal") {
    const proposal = await getProposalsRepository().getProposalById(node.nodeId);
    flags.proposal_reviewed = proposal !== null && proposal.reviewed_at !== null;
  }
  if (node.nodeType === "contract") {
    try {
      const contract = await getContract(node.nodeId);
      flags.contract_signed = contract.signature_status === "signed";
    } catch {
      flags.contract_signed = false;
    }
  }
  if (node.nodeType === "media_asset") {
    flags.media_asset_approved = mediaAssetStatus === "approved";
  }
  return flags;
}

interface WorkspaceDataset {
  relationships: KnowledgeRelationship[];
  existingNodeKeys: Set<string>;
  folders: Awaited<ReturnType<typeof getMediaFolders>>;
  nodesToValidate: KnowledgeNodeRef[];
}

/**
 * `existingNodeKeys` here is a genuine, entity-by-entity existence set
 * (every real Client/Event/Contract/Proposal/Invoice/Asset/Folder/
 * Collection id this workspace actually has) — deliberately more complete
 * than `businessHealthActions.ts`'s own `existingNodeKeys` (which only
 * tracks Media Asset *owner* references, sufficient for that file's
 * narrower orphan-detection purpose). Objective dependencies can point at
 * any of these entity types directly, so a narrower set would produce
 * false "doesn't exist" positives for perfectly real Clients/Events.
 */
async function fetchWorkspaceDataset(workspaceId: string): Promise<WorkspaceDataset> {
  const [relationships, clients, events, contracts, invoices, folders, collections] = await Promise.all([
    getCoreKnowledgeGraphService().listRelationshipsForWorkspace(workspaceId, true),
    getClients({}),
    getEvents({ includeArchived: false }),
    getContracts({ includeArchived: true }),
    getInvoices({ includeArchived: true }),
    getMediaFolders(),
    getMediaCollections(),
  ]);
  const assets = readMediaAssets().filter((a) => a.workspace_id === workspaceId);
  const proposalsByEvent = await Promise.all(events.map((event) => getProposalsRepository().getProposalsByEvent(event.id)));
  const proposals = proposalsByEvent.flat();

  const existingNodeKeys = new Set<string>([
    ...clients.map((c) => `client:${c.id}`),
    ...events.map((e) => `event:${e.id}`),
    ...contracts.map((c) => `contract:${c.id}`),
    ...invoices.map((i) => `invoice:${i.id}`),
    ...proposals.map((p) => `proposal:${p.id}`),
    ...assets.map((a) => `media_asset:${a.id}`),
    ...folders.map((f) => `media_folder:${f.id}`),
    ...collections.map((c) => `media_collection:${c.id}`),
  ]);

  const nodeMap = new Map<string, KnowledgeNodeRef>();
  for (const r of relationships) {
    nodeMap.set(`${r.source_node_type}:${r.source_node_id}`, { nodeType: r.source_node_type, nodeId: r.source_node_id });
    nodeMap.set(`${r.target_node_type}:${r.target_node_id}`, { nodeType: r.target_node_type, nodeId: r.target_node_id });
  }

  return { relationships, existingNodeKeys, folders, nodesToValidate: Array.from(nodeMap.values()) };
}

async function resolveRequirementContext(node: KnowledgeNodeRef, dataset: WorkspaceDataset, workspaceId: string, businessRuleViolations: BusinessRuleViolation[]): Promise<RequirementContext> {
  const mediaAsset = node.nodeType === "media_asset" ? readMediaAssets().find((a) => a.id === node.nodeId) ?? null : null;
  const comments = ENTITY_TYPE_SET.has(node.nodeType) ? await getCoreCommentsService().getCommentsForOwner(workspaceId, node.nodeType as EntityType, node.nodeId) : [];
  const timelineActivities = readActivities().filter((a) => a.workspace_id === workspaceId && a.owner_type === node.nodeType && a.owner_id === node.nodeId);
  const approvalFlags = await resolveApprovalFlags(node, mediaAsset?.status ?? null);

  return {
    relationships: dataset.relationships,
    comments,
    timelineActivities,
    mediaMetadata: mediaAsset?.metadata ?? null,
    mediaTags: mediaAsset?.tags ?? null,
    approvalFlags,
    businessRuleViolations: businessRuleViolations.filter((v) => v.node.nodeType === node.nodeType && v.node.nodeId === node.nodeId),
  };
}

function resolveDependencyContext(dataset: WorkspaceDataset, objectiveStatusById: Map<string, ObjectiveStatus>, approvalFlags: Record<string, boolean>, businessRuleViolations: BusinessRuleViolation[]): DependencyContext {
  return { objectiveStatusById, existingNodeKeys: dataset.existingNodeKeys, businessRuleViolations, approvalFlags };
}

export async function createObjectiveAction(input: CreateObjectiveInput): Promise<{ success: true; data: Objective } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("objectives.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreObjectivesService().createObjective(session.workspace.id, session.membership.id, input);
  if (!result.success) return { success: false, error: result.error };

  const event = objectiveTimelineEventForTransition(null, result.data.status, result.data.title);
  const ownerType = result.data.node?.nodeType ?? "workspace";
  const ownerId = result.data.node?.nodeId ?? session.workspace.id;
  if (ENTITY_TYPE_SET.has(ownerType)) recordTimelineActivity(session.workspace.id, ownerType as EntityType, ownerId, event.type, event.description);

  return { success: true, data: result.data };
}

export async function listObjectivesAction(includeArchived = false): Promise<{ success: true; data: Objective[] } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const objectives = await getCoreObjectivesService().listObjectivesForWorkspace(session.workspace.id, includeArchived);
  return { success: true, data: objectives };
}

export interface ObjectiveEvaluation {
  objective: Objective;
  progress: ObjectiveProgress;
  health: ObjectiveHealth;
}

export interface EvaluateObjectivesResult {
  evaluations: ObjectiveEvaluation[];
  scorecard: WorkspaceScorecard;
}

export async function evaluateObjectivesAction(): Promise<{ success: true; data: EvaluateObjectivesResult } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const now = nowIso();

  const [objectives, dataset, businessHealthResult] = await Promise.all([
    getCoreObjectivesService().listObjectivesForWorkspace(workspaceId, false),
    fetchWorkspaceDataset(workspaceId),
    evaluateBusinessHealthAction(),
  ]);

  const businessRuleViolations = computeBusinessRuleViolations({ nodesToValidate: dataset.nodesToValidate, relationships: dataset.relationships, folders: dataset.folders });
  const objectiveStatusById = new Map(objectives.map((o) => [o.id, o.status] as const));

  const evaluations: ObjectiveEvaluation[] = [];
  for (const objective of objectives) {
    const node = objective.node ?? { nodeType: "workspace" as const, nodeId: workspaceId };
    const requirementContext = await resolveRequirementContext(node, dataset, workspaceId, businessRuleViolations);
    const dependencyContext = resolveDependencyContext(dataset, objectiveStatusById, requirementContext.approvalFlags, businessRuleViolations);

    const progress = computeObjectiveProgress(objective, requirementContext);
    const dependencyEvaluations = evaluateDependencies(objective.dependencies, dependencyContext);
    const progressWithDependencyIssues: ObjectiveProgress = { ...progress, blockingIssues: dependencyEvaluations.filter((d) => !d.satisfied).map((d) => d.detail) };
    const health = computeObjectiveHealth(objective, progressWithDependencyIssues, dependencyEvaluations, now);

    evaluations.push({ objective, progress: progressWithDependencyIssues, health });
  }

  const effectiveStatuses = new Map(evaluations.map((e) => [e.objective.id, e.health.effectiveStatus] as const));
  const businessHealthOverallScore = businessHealthResult.success ? businessHealthResult.data.businessHealth.overallScore : 0;
  const scorecard = computeWorkspaceScorecard({ effectiveStatuses, progresses: evaluations.map((e) => e.progress), businessHealthOverallScore, evaluatedAt: now });

  return { success: true, data: { evaluations, scorecard } };
}

export async function updateObjectiveStatusAction(objectiveId: string, nextStatus: ObjectiveStatus): Promise<{ success: true; data: Objective } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("objectives.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const objective = await getCoreObjectivesService().getObjectiveById(objectiveId);
  if (!objective || objective.workspace_id !== workspaceId) return { success: false, error: "This objective could not be found." };

  const dataset = await fetchWorkspaceDataset(workspaceId);
  const businessRuleViolations = computeBusinessRuleViolations({ nodesToValidate: dataset.nodesToValidate, relationships: dataset.relationships, folders: dataset.folders });
  const node = objective.node ?? { nodeType: "workspace" as const, nodeId: workspaceId };
  const requirementContext = await resolveRequirementContext(node, dataset, workspaceId, businessRuleViolations);
  const allObjectives = await getCoreObjectivesService().listObjectivesForWorkspace(workspaceId, true);
  const objectiveStatusById = new Map(allObjectives.map((o) => [o.id, o.status] as const));
  const dependencyContext = resolveDependencyContext(dataset, objectiveStatusById, requirementContext.approvalFlags, businessRuleViolations);

  const progress = computeObjectiveProgress(objective, requirementContext);
  const dependencyEvaluations = evaluateDependencies(objective.dependencies, dependencyContext);
  const check = validateStatusTransition(nextStatus, progress, dependencyEvaluations);
  if (!check.allowed) return { success: false, error: check.blockingReasons.join(" ") };

  const result = await getCoreObjectivesService().setObjectiveStatus(objectiveId, workspaceId, nextStatus);
  if (!result.success) return { success: false, error: result.error };

  const event = objectiveTimelineEventForTransition(objective.status, nextStatus, objective.title);
  const ownerType = node.nodeType;
  if (ENTITY_TYPE_SET.has(ownerType)) recordTimelineActivity(workspaceId, ownerType as EntityType, node.nodeId, event.type, event.description);

  return { success: true, data: result.data };
}
