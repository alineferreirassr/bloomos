import { getInboundRelationships } from "@/core/knowledge/graphTraversalEngine";
import type { KnowledgeRelationship, KnowledgeNodeRef, ImpactAnalysisResult, DependencyItem, KnowledgeNodeType } from "@/types/knowledgeGraph";

/**
 * Step 10.8 — named impact categories, over the exact same `computeImpactAnalysis`
 * result. "Affected Timeline Entries" and "Affected AI Context" have no
 * dedicated `KnowledgeNodeType` bucket of their own: a Timeline entry is
 * represented by an inbound `appears_in_timeline` edge (already one of the
 * 29 relationship types), and AI Context is the existing `ai_insight` node
 * type — both map onto infrastructure Step 10.5 already built, not new
 * concepts.
 */
export interface DetailedImpactBreakdown {
  base: ImpactAnalysisResult;
  affectedAssets: DependencyItem[];
  affectedClients: DependencyItem[];
  affectedEvents: DependencyItem[];
  affectedDocuments: DependencyItem[];
  affectedWorkflows: DependencyItem[];
  affectedAutomations: DependencyItem[];
  affectedCollections: DependencyItem[];
  affectedTimelineEntries: DependencyItem[];
  affectedAiContext: DependencyItem[];
}

/**
 * v2.0 Checkpoint 25, Step 10.5 — Impact Analysis / Dependency Engine.
 * "Before deleting, replacing, or archiving an asset, BloomOS should
 * answer: where is this used, which entities depend on it" (spec). Pure —
 * reuses `graphTraversalEngine`'s own `getInboundRelationships` (everything
 * pointing *at* this node is, by definition, a dependent) rather than a
 * second traversal implementation.
 */

const ACTIVE_EVENT_TYPES = new Set(["event"]);

function labelForNode(node: KnowledgeNodeRef): string {
  return `${node.nodeType}:${node.nodeId}`;
}

export function computeImpactAnalysis(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[]): ImpactAnalysisResult {
  const inbound = getInboundRelationships(node, relationships);

  const byNodeType: Partial<Record<KnowledgeNodeType, DependencyItem[]>> = {};
  for (const r of inbound) {
    const dependentNode: KnowledgeNodeRef = { nodeType: r.source_node_type, nodeId: r.source_node_id };
    const item: DependencyItem = { node: dependentNode, relationshipType: r.relationship_type, label: labelForNode(dependentNode) };
    const bucket = byNodeType[dependentNode.nodeType] ?? [];
    bucket.push(item);
    byNodeType[dependentNode.nodeType] = bucket;
  }

  const hasActiveEventDependents = inbound.some((r) => ACTIVE_EVENT_TYPES.has(r.source_node_type));
  const hasApprovalDependents = inbound.some((r) => r.relationship_type === "approved_by" || r.relationship_type === "rejected_by");
  const hasAutomationOrWorkflowDependents = inbound.some((r) => r.relationship_type === "produced_by_automation" || r.relationship_type === "produced_by_workflow" || r.relationship_type === "triggered_by");

  return {
    node,
    totalDependents: inbound.length,
    byNodeType,
    hasActiveEventDependents,
    hasApprovalDependents,
    hasAutomationOrWorkflowDependents,
    isSafeToDelete: inbound.length === 0,
  };
}

/**
 * Before any destructive operation (delete/replace/archive/move) — "Display:
 * Affected Assets / Clients / Events / Documents / Workflows / Automations /
 * Timeline Entries / Collections / AI Context" (spec). Reuses
 * `computeImpactAnalysis`'s own grouping rather than re-walking the
 * relationship array a second time.
 */
export function computeDetailedImpact(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[]): DetailedImpactBreakdown {
  const base = computeImpactAnalysis(node, relationships);
  const inbound = getInboundRelationships(node, relationships);

  const affectedTimelineEntries: DependencyItem[] = inbound
    .filter((r) => r.relationship_type === "appears_in_timeline")
    .map((r) => {
      const dependentNode: KnowledgeNodeRef = { nodeType: r.source_node_type, nodeId: r.source_node_id };
      return { node: dependentNode, relationshipType: r.relationship_type, label: labelForNode(dependentNode) };
    });

  return {
    base,
    affectedAssets: base.byNodeType.media_asset ?? [],
    affectedClients: base.byNodeType.client ?? [],
    affectedEvents: base.byNodeType.event ?? [],
    affectedDocuments: base.byNodeType.document ?? [],
    affectedWorkflows: base.byNodeType.workflow ?? [],
    affectedAutomations: base.byNodeType.automation ?? [],
    affectedCollections: base.byNodeType.media_collection ?? [],
    affectedTimelineEntries,
    affectedAiContext: base.byNodeType.ai_insight ?? [],
  };
}
