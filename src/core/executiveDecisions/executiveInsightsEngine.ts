import type { Decision, ExecutiveInsights, TopEntry } from "@/types/executiveDecisions";
import type { Objective, ObjectiveHealth } from "@/types/objectives";
import type { KnowledgeNodeRef, KnowledgeRelationship } from "@/types/knowledgeGraph";
import type { BusinessRuleViolation } from "@/types/businessHealth";

/**
 * v2.0 Checkpoint 25.7, Step 13 — Executive Insights Engine. Every insight
 * is a group-and-count over data some other engine already computed
 * (`Decision[]`, `ObjectiveHealth[]`, the Knowledge Graph's own
 * relationships, `BusinessRuleViolation[]`) — nothing here is inferred or
 * predicted, and nothing is detected that wasn't already found elsewhere.
 */

const DEFAULT_LIMIT = 5;

function nodeKey(node: KnowledgeNodeRef): string {
  return `${node.nodeType}:${node.nodeId}`;
}

function topByCount(nodes: KnowledgeNodeRef[], labelFor: (node: KnowledgeNodeRef) => string, limit: number): TopEntry[] {
  const counts = new Map<string, { node: KnowledgeNodeRef; count: number }>();
  for (const node of nodes) {
    const key = nodeKey(node);
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { node, count: 1 });
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((e) => ({ node: e.node, label: labelFor(e.node), count: e.count }));
}

export interface ExecutiveInsightsInput {
  decisions: Decision[];
  objectiveEvaluations: { objective: Objective; health: ObjectiveHealth }[];
  relationships: KnowledgeRelationship[];
  businessRuleViolations: BusinessRuleViolation[];
  limit?: number;
}

export function computeExecutiveInsights(input: ExecutiveInsightsInput): ExecutiveInsights {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const label = (node: KnowledgeNodeRef) => `${node.nodeType}:${node.nodeId}`;

  const mostImpactedClients = topByCount(
    input.decisions.flatMap((d) => d.related_entities.filter((n) => n.nodeType === "client")),
    label,
    limit,
  );

  const mostCriticalAssets = topByCount(
    input.decisions.filter((d) => d.priority === "critical").flatMap((d) => d.related_assets),
    label,
    limit,
  );

  const mostOverloadedEvents = topByCount(
    input.decisions.flatMap((d) => d.related_entities.filter((n) => n.nodeType === "event")),
    label,
    limit,
  );

  const mostReferencedDocuments = topByCount(
    input.relationships.filter((r) => r.status === "active" && r.target_node_type === "document").map((r) => ({ nodeType: r.target_node_type, nodeId: r.target_node_id })),
    label,
    limit,
  );

  const violationCounts = new Map<string, number>();
  for (const v of input.businessRuleViolations) violationCounts.set(v.ruleId, (violationCounts.get(v.ruleId) ?? 0) + 1);
  const mostViolatedBusinessRules = Array.from(violationCounts.entries())
    .map(([ruleId, count]) => ({ ruleId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  const mostBlockedObjectives = input.objectiveEvaluations
    .filter((e) => e.health.state === "blocked")
    .map((e) => ({ node: e.objective.node ?? { nodeType: "workspace" as const, nodeId: e.objective.workspace_id }, label: e.objective.title, count: e.health.reasons.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return {
    mostImpactedClients,
    mostBlockedObjectives,
    mostCriticalAssets,
    mostReferencedDocuments,
    mostViolatedBusinessRules,
    mostOverloadedEvents,
    mostFragileWorkflows: {
      entries: [],
      notApplicableReason: 'No constraint rules or health signal exist yet for the "workflow" node type — the identical, already-disclosed reason `businessHealthEngine.ts` (Step 15.5) marks `workflow_readiness` `notApplicable`.',
    },
  };
}
