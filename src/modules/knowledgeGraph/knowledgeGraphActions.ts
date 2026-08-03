"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { validateRelationshipMutation, validateNodeConstraints } from "@/core/knowledge/relationshipConstraintsEngine";
import { oneHop, multiHop, shortestPath, getRelationshipCounts } from "@/core/knowledge/graphTraversalEngine";
import { computeDetailedImpact } from "@/core/knowledge/impactAnalysisEngine";
import { findDuplicateRelationships } from "@/core/knowledge/orphanDetectionEngine";
import { computeKnowledgeHealth, type KnowledgeHealthReport } from "@/core/knowledge/knowledgeHealthEngine";
import {
  generateRelationshipSummary,
  generateAssetUsageSummary,
  generateEntityConnectionSummary,
  generateDependencySummary,
  generateSemanticContext,
  generateImpactContext,
  generateTimelineContext,
} from "@/core/knowledge/knowledgeGraphBrief";
import type { CreateRelationshipInput } from "@/lib/data/core/knowledge/knowledgeGraphStore";
import { RELATIONSHIP_TYPE_LABELS, type KnowledgeNodeRef, type KnowledgeNodeType, type RelationshipSemantics, type RelationshipType } from "@/types/knowledgeGraph";
import type { ConstraintViolation } from "@/types/relationshipConstraints";
import type { DataResult } from "@/lib/data/result";
import { readMediaAssets } from "@/lib/data/mock/mediaAssetsStore";
import { recordTimelineActivity, readActivities } from "@/lib/data/mock/timelineStore";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);

/**
 * v2.0 Checkpoint 40 — Global Search & Universal Command Center added
 * `workflow`/`decision`/`objective`/`dispatch_order`/`route_plan`/
 * `operational_plan`/`execution_package`/`resource_bundle` to `ENTITY_TYPES`
 * purely so Search could register real routes for them (`core/search/
 * defaultRegistrations.ts`) — none of them ever gained real Timeline
 * recording (confirmed: no call site anywhere passes one of these as
 * `recordTimelineActivity()`'s own `ownerType`; Decision/Objective Timeline
 * events record against their *related entity*, never against
 * `"decision"`/`"objective"` themselves — see `recordDecisionTimelineEvent`
 * in `executiveDecisionsActions.ts`). `ENTITY_TYPE_SET` alone is no longer
 * an accurate "is this Timeline-capable" proxy now that it's grown to
 * include these, so this narrower set removes exactly the ones that were
 * never Timeline-capable, preserving the exact pre-Checkpoint-40 behavior
 * `recordGraphTimelineEvent`'s own comment below already documents (Comment/
 * Workflow/AI Insight don't own a Timeline).
 */
const NON_TIMELINE_CAPABLE_ENTITY_TYPES = new Set<string>(["workflow", "decision", "objective", "dispatch_order", "route_plan", "operational_plan", "execution_package", "resource_bundle"]);

function isTimelineCapableEntityType(nodeType: string): boolean {
  return ENTITY_TYPE_SET.has(nodeType) && !NON_TIMELINE_CAPABLE_ENTITY_TYPES.has(nodeType);
}

/** Step 13 — Timeline Integration. A graph node only gets a Timeline entry when it's a Timeline-capable EntityType (Comment/Workflow/AI Insight nodes aren't); prefers the source side, falling back to the target, and is silently a no-op when neither qualifies. */
function recordGraphTimelineEvent(workspaceId: string, source: KnowledgeNodeRef, target: KnowledgeNodeRef, type: TimelineActivityType, description: string): void {
  const owner = isTimelineCapableEntityType(source.nodeType) ? source : isTimelineCapableEntityType(target.nodeType) ? target : null;
  if (!owner) return;
  recordTimelineActivity(workspaceId, owner.nodeType as EntityType, owner.nodeId, type, description);
}

function nodeRefLabel(node: KnowledgeNodeRef): string {
  return `${node.nodeType}:${node.nodeId}`;
}

const GENERIC_ACCESS_ERROR = "The Knowledge Graph isn't available. You may not have access to it.";

/**
 * v2.0 Checkpoint 25, Steps 10.5–10.9 — the module layer every Knowledge
 * Graph UI (Relationship Explorer, Asset Intelligence's Knowledge/
 * Dependencies/Impact sections) calls through, mirroring
 * `commentsActions.ts`'s own shape exactly: resolve the session once,
 * delegate to the pure engines/store, never reimplement graph logic here.
 */

export async function listWorkspaceRelationshipsAction(includeInactive = false) {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false as const, error: GENERIC_ACCESS_ERROR };
  const relationships = await getCoreKnowledgeGraphService().listRelationshipsForWorkspace(session.workspace.id, includeInactive);
  return { success: true as const, data: relationships };
}

export interface NodeKnowledgeData {
  oneHop: ReturnType<typeof oneHop>;
  counts: ReturnType<typeof getRelationshipCounts>;
  constraintViolations: ConstraintViolation[];
  impact: ReturnType<typeof computeDetailedImpact>;
  relationshipSummary: string;
  usageSummary: string;
  connectionSummary: string;
  dependencySummary: string;
}

export async function getNodeRelationshipsAction(node: KnowledgeNodeRef): Promise<DataResult<NodeKnowledgeData>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const relationships = await getCoreKnowledgeGraphService().listRelationshipsForWorkspace(session.workspace.id);
  return {
    success: true,
    data: {
      oneHop: oneHop(node, relationships),
      counts: getRelationshipCounts(node, relationships),
      constraintViolations: validateNodeConstraints(node, relationships) as ConstraintViolation[],
      impact: computeDetailedImpact(node, relationships),
      relationshipSummary: generateRelationshipSummary(node, relationships),
      usageSummary: generateAssetUsageSummary(node, relationships),
      connectionSummary: generateEntityConnectionSummary(node, relationships),
      dependencySummary: generateDependencySummary(node, relationships),
    },
  };
}

/**
 * v2.0 Checkpoint 25, Step 14 — Bloom AI Context Layer. Deterministic only:
 * every field here is a plain-template string over already-computed facts
 * (`knowledgeGraphBrief.ts`), never an LLM call and never a speculative
 * relationship — "Expose deterministic APIs only" (spec). This is the one
 * function a future Bloom AI Skill would call to get everything it needs
 * about a record's place in the graph, in one round trip.
 */
export interface BloomAiKnowledgeContext {
  entityContext: string;
  assetContext: string;
  relationshipContext: string;
  dependencyContext: string;
  semanticContext: string;
  impactContext: string;
  timelineContext: string;
}

export async function getBloomAiKnowledgeContextAction(node: KnowledgeNodeRef): Promise<DataResult<BloomAiKnowledgeContext>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const relationships = await getCoreKnowledgeGraphService().listRelationshipsForWorkspace(session.workspace.id);
  const relationshipContext = generateRelationshipSummary(node, relationships);
  const connectionContext = generateEntityConnectionSummary(node, relationships);
  const nodeActivities = isTimelineCapableEntityType(node.nodeType)
    ? readActivities().filter((a) => a.workspace_id === session.workspace.id && a.owner_type === node.nodeType && a.owner_id === node.nodeId)
    : [];

  return {
    success: true,
    data: {
      entityContext: `${connectionContext} ${relationshipContext}`,
      assetContext: generateAssetUsageSummary(node, relationships),
      relationshipContext,
      dependencyContext: generateDependencySummary(node, relationships),
      semanticContext: generateSemanticContext(node, relationships),
      impactContext: generateImpactContext(node, relationships),
      timelineContext: generateTimelineContext(nodeActivities),
    },
  };
}

export async function multiHopAction(node: KnowledgeNodeRef, maxDepth = 3) {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false as const, error: GENERIC_ACCESS_ERROR };
  const relationships = await getCoreKnowledgeGraphService().listRelationshipsForWorkspace(session.workspace.id);
  return { success: true as const, data: multiHop(node, relationships, maxDepth) };
}

export async function findShortestPathAction(from: KnowledgeNodeRef, to: KnowledgeNodeRef) {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false as const, error: GENERIC_ACCESS_ERROR };
  const relationships = await getCoreKnowledgeGraphService().listRelationshipsForWorkspace(session.workspace.id);
  return { success: true as const, data: shortestPath(from, to, relationships) };
}

export async function createRelationshipAction(
  source: KnowledgeNodeRef,
  target: KnowledgeNodeRef,
  relationshipType: RelationshipType,
  semantics: RelationshipSemantics | null = null,
): Promise<DataResult<unknown>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const existing = await getCoreKnowledgeGraphService().listRelationshipsForWorkspace(session.workspace.id);
  const check = validateRelationshipMutation(source, target, relationshipType, existing);
  if (!check.allowed) {
    recordGraphTimelineEvent(
      session.workspace.id,
      source,
      target,
      "knowledge_relationship_constraint_violated",
      `Blocked ${RELATIONSHIP_TYPE_LABELS[relationshipType]} relationship: ${check.hardViolations.join(" ")}`,
    );
    return { success: false, error: check.hardViolations.join(" ") };
  }

  const input: CreateRelationshipInput = {
    sourceNodeType: source.nodeType,
    sourceNodeId: source.nodeId,
    targetNodeType: target.nodeType,
    targetNodeId: target.nodeId,
    relationshipType,
    source: "user_action",
    semantics,
  };
  const result = await getCoreKnowledgeGraphService().createRelationship(session.workspace.id, session.membership.id, input);
  if (result.success) {
    recordGraphTimelineEvent(
      session.workspace.id,
      source,
      target,
      "knowledge_relationship_created",
      `${RELATIONSHIP_TYPE_LABELS[relationshipType]}: ${nodeRefLabel(source)} → ${nodeRefLabel(target)}`,
    );
  }
  return result;
}

export async function removeRelationshipAction(id: string) {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false as const, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreKnowledgeGraphService().removeRelationship(id, session.workspace.id);
  if (result.success) {
    const source: KnowledgeNodeRef = { nodeType: result.data.source_node_type, nodeId: result.data.source_node_id };
    const target: KnowledgeNodeRef = { nodeType: result.data.target_node_type, nodeId: result.data.target_node_id };
    recordGraphTimelineEvent(
      session.workspace.id,
      source,
      target,
      "knowledge_relationship_removed",
      `${RELATIONSHIP_TYPE_LABELS[result.data.relationship_type]} removed: ${nodeRefLabel(source)} → ${nodeRefLabel(target)}`,
    );
  }
  return result;
}

export async function setRelationshipSemanticsAction(id: string, semantics: RelationshipSemantics | null) {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false as const, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreKnowledgeGraphService().setRelationshipSemantics(id, session.workspace.id, semantics);
  if (result.success) {
    const source: KnowledgeNodeRef = { nodeType: result.data.source_node_type, nodeId: result.data.source_node_id };
    const target: KnowledgeNodeRef = { nodeType: result.data.target_node_type, nodeId: result.data.target_node_id };
    recordGraphTimelineEvent(
      session.workspace.id,
      source,
      target,
      "knowledge_relationship_semantics_updated",
      semantics?.role
        ? `${nodeRefLabel(source)} reclassified as "${semantics.role.replace(/_/g, " ")}"`
        : `Business meaning cleared for ${nodeRefLabel(source)} → ${nodeRefLabel(target)}`,
    );
  }
  return result;
}

export interface GraphStats {
  totalActive: number;
  totalArchived: number;
  totalRejected: number;
  byRelationshipType: Partial<Record<RelationshipType, number>>;
  byNodeType: Partial<Record<KnowledgeNodeType, number>>;
  duplicateGroupCount: number;
}

/** Step 10.9 — Graph Statistics, computed over the full workspace relationship set. */
export async function getGraphStatsAction(): Promise<DataResult<GraphStats>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const all = await getCoreKnowledgeGraphService().listRelationshipsForWorkspace(session.workspace.id, true);
  const byRelationshipType: Partial<Record<RelationshipType, number>> = {};
  const byNodeType: Partial<Record<KnowledgeNodeType, number>> = {};

  for (const r of all) {
    if (r.status !== "active") continue;
    byRelationshipType[r.relationship_type] = (byRelationshipType[r.relationship_type] ?? 0) + 1;
    byNodeType[r.source_node_type] = (byNodeType[r.source_node_type] ?? 0) + 1;
    byNodeType[r.target_node_type] = (byNodeType[r.target_node_type] ?? 0) + 1;
  }

  return {
    success: true,
    data: {
      totalActive: all.filter((r) => r.status === "active").length,
      totalArchived: all.filter((r) => r.status === "archived").length,
      totalRejected: all.filter((r) => r.status === "rejected").length,
      byRelationshipType,
      byNodeType,
      duplicateGroupCount: findDuplicateRelationships(all).length,
    },
  };
}

/** Step 12's own orphan check, scoped to Media Assets — the only entity this checkpoint has real inventory for. */
/** Step 12 — Knowledge Health Engine, run over the whole workspace: broken relationships, orphaned assets, duplicate/circular references, and constraint violations for every node the graph currently knows about. */
export async function getKnowledgeHealthAction(): Promise<DataResult<KnowledgeHealthReport>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const assets = readMediaAssets().filter((a) => a.workspace_id === session.workspace.id);
  const relationships = await getCoreKnowledgeGraphService().listRelationshipsForWorkspace(session.workspace.id, true);
  const existingNodeKeys = new Set(assets.map((a) => `${a.owner_type}:${a.owner_id}`));

  const nodeMap = new Map<string, KnowledgeNodeRef>();
  for (const r of relationships) {
    nodeMap.set(`${r.source_node_type}:${r.source_node_id}`, { nodeType: r.source_node_type, nodeId: r.source_node_id });
    nodeMap.set(`${r.target_node_type}:${r.target_node_id}`, { nodeType: r.target_node_type, nodeId: r.target_node_id });
  }

  return {
    success: true,
    data: computeKnowledgeHealth({ assets, relationships, existingNodeKeys, nodesToValidate: Array.from(nodeMap.values()) }),
  };
}
