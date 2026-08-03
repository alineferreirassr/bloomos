import { getRelationshipCounts, getInboundRelationships, getOutboundRelationships } from "@/core/knowledge/graphTraversalEngine";
import { computeImpactAnalysis, computeDetailedImpact } from "@/core/knowledge/impactAnalysisEngine";
import { RELATIONSHIP_TYPE_LABELS, RELATIONSHIP_ROLE_LABELS } from "@/types/knowledgeGraph";
import type { KnowledgeRelationship, KnowledgeNodeRef, OrphanedAssetFinding } from "@/types/knowledgeGraph";
import type { TimelineActivity } from "@/types/timelineActivity";

/**
 * v2.0 Checkpoint 25, Step 10.5 — Bloom AI Knowledge Context. Same
 * discipline as `generateExecutiveBrief`/`generateCommunicationBrief`: a
 * plain template over already-computed facts, never an LLM call, never a
 * speculative relationship. "Prepare the Knowledge Graph as a future
 * context source for Bloom AI" (spec) — these summaries are exactly that
 * preparation: real, structured text a future Skill could read, without
 * this checkpoint calling a model itself.
 */

export function generateRelationshipSummary(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[]): string {
  const counts = getRelationshipCounts(node, relationships);
  if (counts.total === 0) return `${node.nodeType} ${node.nodeId} has no recorded relationships.`;
  return `${node.nodeType} ${node.nodeId} has ${counts.total} relationship${counts.total === 1 ? "" : "s"} (${counts.outbound} outbound, ${counts.inbound} inbound).`;
}

export function generateAssetUsageSummary(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[]): string {
  const impact = computeImpactAnalysis(node, relationships);
  if (impact.totalDependents === 0) return `This asset is not currently referenced by any other record.`;
  const parts = Object.entries(impact.byNodeType).map(([nodeType, items]) => `${items?.length ?? 0} ${nodeType}`);
  return `This asset is used by ${impact.totalDependents} record${impact.totalDependents === 1 ? "" : "s"}: ${parts.join(", ")}.`;
}

export function generateEntityConnectionSummary(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[]): string {
  const counts = getRelationshipCounts(node, relationships);
  const byType = new Map<string, number>();
  for (const r of [...relationships.filter((r) => r.source_node_type === node.nodeType && r.source_node_id === node.nodeId), ...relationships.filter((r) => r.target_node_type === node.nodeType && r.target_node_id === node.nodeId)]) {
    byType.set(r.relationship_type, (byType.get(r.relationship_type) ?? 0) + 1);
  }
  const breakdown = Array.from(byType.entries())
    .map(([type, count]) => `${count} ${RELATIONSHIP_TYPE_LABELS[type as keyof typeof RELATIONSHIP_TYPE_LABELS]}`)
    .join(", ");
  return counts.total === 0 ? "No connections recorded yet." : `Connections: ${breakdown}.`;
}

export function generateDependencySummary(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[]): string {
  const impact = computeImpactAnalysis(node, relationships);
  if (impact.isSafeToDelete) return "Nothing depends on this record — safe to remove without affecting other data.";
  const warnings: string[] = [];
  if (impact.hasActiveEventDependents) warnings.push("an active Event");
  if (impact.hasApprovalDependents) warnings.push("an Approval");
  if (impact.hasAutomationOrWorkflowDependents) warnings.push("an Automation or Workflow");
  const warningText = warnings.length > 0 ? ` This includes ${warnings.join(", ")}.` : "";
  return `${impact.totalDependents} record${impact.totalDependents === 1 ? "" : "s"} depend on this — removing it would affect them.${warningText}`;
}

/** Step 14 — Semantic Context: describes every business-meaning-tagged relationship touching this node. A node with no `semantics` assigned yet gets an honest "no business meaning assigned" line, never a fabricated one. */
export function generateSemanticContext(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[]): string {
  const touching = [...getOutboundRelationships(node, relationships), ...getInboundRelationships(node, relationships)].filter((r) => r.semantics !== null);
  if (touching.length === 0) return "No business meaning has been assigned to this record's relationships yet.";
  const parts = touching.map((r) => {
    const role = r.semantics?.role ? RELATIONSHIP_ROLE_LABELS[r.semantics.role] : RELATIONSHIP_TYPE_LABELS[r.relationship_type];
    const category = r.semantics?.category ? ` (${r.semantics.category})` : "";
    return `${role}${category}`;
  });
  return `Business meaning: ${parts.join(", ")}.`;
}

/** Step 14 — Impact Context: a text rendering of `computeDetailedImpact`'s named categories, for a future Skill that wants prose rather than the structured breakdown. */
export function generateImpactContext(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[]): string {
  const detailed = computeDetailedImpact(node, relationships);
  if (detailed.base.isSafeToDelete) return "No other record depends on this — safe to change or remove.";
  const categories: [string, number][] = [
    ["Assets", detailed.affectedAssets.length],
    ["Clients", detailed.affectedClients.length],
    ["Events", detailed.affectedEvents.length],
    ["Documents", detailed.affectedDocuments.length],
    ["Workflows", detailed.affectedWorkflows.length],
    ["Automations", detailed.affectedAutomations.length],
    ["Collections", detailed.affectedCollections.length],
    ["Timeline Entries", detailed.affectedTimelineEntries.length],
    ["AI Context", detailed.affectedAiContext.length],
  ];
  const nonZero = categories.filter(([, count]) => count > 0).map(([label, count]) => `${count} ${label}`);
  return `Changing this would affect: ${nonZero.join(", ")}.`;
}

/** Step 14 — Timeline Context: a plain summary of this node's own recent Timeline activity, when it's a Timeline-capable EntityType (the caller supplies the activities already filtered to this node's owner_type/owner_id — this function never fetches). */
export function generateTimelineContext(activities: TimelineActivity[]): string {
  if (activities.length === 0) return "No recent Timeline activity recorded for this record.";
  const recent = [...activities].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);
  return `Recent activity: ${recent.map((a) => a.description).join("; ")}.`;
}

export function generateOrphanedAssetSummary(findings: OrphanedAssetFinding[]): string {
  if (findings.length === 0) return "No orphaned assets detected.";
  const byReason = new Map<string, number>();
  for (const f of findings) byReason.set(f.reason, (byReason.get(f.reason) ?? 0) + 1);
  const breakdown = Array.from(byReason.entries())
    .map(([reason, count]) => `${count} ${reason.replace(/_/g, " ")}`)
    .join(", ");
  return `${findings.length} orphan finding${findings.length === 1 ? "" : "s"} across the workspace: ${breakdown}.`;
}
