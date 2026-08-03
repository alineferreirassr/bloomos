import { computePriority, type DecisionFactors } from "@/core/executiveDecisions/priorityEngine";
import type { CreateDecisionInput } from "@/lib/data/mock/decisionsStore";
import type { DecisionCategory } from "@/types/executiveDecisions";
import type { OperationalRecommendation, RecommendationSeverity } from "@/types/businessHealth";
import type { KnowledgeNodeRef, KnowledgeNodeType, KnowledgeRelationship } from "@/types/knowledgeGraph";
import type { Document } from "@/types/document";

/**
 * v2.0 Checkpoint 25.7, Step 1 — Executive Decision Engine. Detects
 * nothing itself. Every Decision it drafts is a translation of a finding
 * an earlier engine already computed: an `OperationalRecommendation`
 * (Step 15.5/15.6 — already carries `ruleId`/`message`/`severity`/`node`),
 * a `KnowledgeHealthReport` finding (Step 12 — broken/duplicate/circular
 * relationships), or an expired `Document`. Priority is computed here
 * with `ageDays: 0` — every draft is either brand new or about to be
 * deduplicated against an existing open Decision by the store's
 * `upsertDecision`; `executiveDecisionsActions.ts` re-scores every
 * *persisted* Decision afterward using its real `created_at`, so age
 * actually matters for prioritization over time.
 */

const NODE_TYPE_CATEGORY: Partial<Record<KnowledgeNodeType, DecisionCategory>> = {
  lead: "crm",
  client: "crm",
  proposal: "crm",
  event: "events",
  event_service: "events",
  service: "events",
  checklist_item: "events",
  vendor: "vendors",
  invoice: "finance",
  payment: "finance",
  expense: "finance",
  accounting_period: "finance",
  journal_entry: "finance",
  contract: "compliance",
  document: "documents",
  document_folder: "documents",
  media_asset: "assets",
  media_folder: "assets",
  media_collection: "assets",
  workflow: "automation",
  automation: "automation",
  comment: "communication",
  message: "communication",
  ai_insight: "knowledge_graph",
  integration_connection: "security",
  integration_credential: "security",
};

/** Every named category has a real mapping rule; anything not listed above (`workspace`, `inventory_item`, `purchase`, `team_kb_article`, `client_kb_article`, `notification`, `team_member`, `reminder`) falls back to `"operations"` — the same disclosed catch-all `businessHealthEngine.ts` uses for signals that don't cleanly belong to a narrower category. */
function categoryForNode(nodeType: KnowledgeNodeType): DecisionCategory {
  return NODE_TYPE_CATEGORY[nodeType] ?? "operations";
}

/** A `ruleId` naming an approval concept (`"...approval"`, `"...reviewed"`, `"...signed"`) routes to the `Approvals` category regardless of its node's own default — the recommendation is about a pending approval, not about the entity type in general. */
function categoryFor(node: KnowledgeNodeRef, ruleId: string): DecisionCategory {
  if (/approval|reviewed|signed/i.test(ruleId)) return "approvals";
  return categoryForNode(node.nodeType);
}

function severityToRuleSeverity(severity: RecommendationSeverity): "hard" | "soft" | null {
  if (severity === "critical") return "hard";
  if (severity === "warning") return "soft";
  return null;
}

function nodeLabel(node: KnowledgeNodeRef): string {
  return `${node.nodeType}:${node.nodeId}`;
}

function dedupeKey(generatedBy: string, ruleId: string, node: KnowledgeNodeRef): string {
  return `${generatedBy}:${ruleId}:${node.nodeType}:${node.nodeId}`;
}

interface FindingInput {
  title: string;
  description: string;
  node: KnowledgeNodeRef;
  generatedBy: string;
  ruleId: string;
  severity: RecommendationSeverity;
  riskFlag: boolean;
  category?: DecisionCategory;
  relatedObjectiveId?: string;
}

function draftFromFinding(input: FindingInput): CreateDecisionInput {
  const category = input.category ?? categoryFor(input.node, input.ruleId);
  const factors: DecisionFactors = {
    businessImpactCount: 1,
    dependencyCount: 0,
    unmetDependencyCount: 0,
    blockingRelationshipsCount: /broken_relationship|circular_reference|duplicate_relationship_group/.test(input.ruleId) ? 1 : 0,
    operationalReadiness: null,
    objectiveBlocked: false,
    businessRuleSeverity: severityToRuleSeverity(input.severity),
    ageDays: 0,
    riskFlag: input.riskFlag,
  };

  return {
    title: input.title,
    description: input.description,
    category,
    priority: computePriority(factors),
    reason: `${input.generatedBy}:${input.ruleId}`,
    generated_by: input.generatedBy,
    related_entities: [input.node],
    related_assets: input.node.nodeType === "media_asset" ? [input.node] : [],
    related_objective_ids: input.relatedObjectiveId ? [input.relatedObjectiveId] : [],
    related_timeline_activity_ids: [],
    dependencies: [],
    dedupe_key: dedupeKey(input.generatedBy, input.ruleId, input.node),
  };
}

export interface RecommendationSource {
  /** A deterministic engine name — `"business_health_engine"` for readiness `suggestedNextSteps`, `"objective_health_engine"` for objective recommendations. Never `"ai"`. */
  generatedBy: string;
  recommendations: OperationalRecommendation[];
  /** Set only when this source's recommendations all originate from one specific Objective's evaluation, so the resulting Decisions can carry it in `related_objective_ids`. */
  relatedObjectiveId?: string;
}

export interface GenerateDecisionDraftsInput {
  recommendationSources: RecommendationSource[];
  brokenRelationships: KnowledgeRelationship[];
  duplicateRelationshipGroups: KnowledgeRelationship[][];
  circularReferenceGroups: KnowledgeRelationship[][];
  expiredDocuments: Document[];
}

export function generateDecisionDrafts(input: GenerateDecisionDraftsInput): CreateDecisionInput[] {
  const drafts: CreateDecisionInput[] = [];

  for (const source of input.recommendationSources) {
    for (const rec of source.recommendations) {
      drafts.push(
        draftFromFinding({
          title: rec.message,
          description: rec.message,
          node: rec.node,
          generatedBy: source.generatedBy,
          ruleId: rec.ruleId,
          severity: rec.severity,
          riskFlag: rec.ruleId === "circular_dependency",
          relatedObjectiveId: source.relatedObjectiveId,
        }),
      );
    }
  }

  for (const rel of input.brokenRelationships) {
    const node: KnowledgeNodeRef = { nodeType: rel.source_node_type, nodeId: rel.source_node_id };
    drafts.push(
      draftFromFinding({
        title: "Resolve broken relationship",
        description: `A relationship from ${nodeLabel(node)} points at a record that no longer exists.`,
        node,
        generatedBy: "knowledge_health_engine",
        ruleId: `broken_relationship:${rel.id}`,
        severity: "critical",
        riskFlag: false,
        category: "knowledge_graph",
      }),
    );
  }

  for (const group of input.duplicateRelationshipGroups) {
    const first = group[0];
    const node: KnowledgeNodeRef = { nodeType: first.source_node_type, nodeId: first.source_node_id };
    drafts.push(
      draftFromFinding({
        title: "Resolve duplicate relationship group",
        description: `${group.length} duplicate relationships were found for ${nodeLabel(node)}.`,
        node,
        generatedBy: "knowledge_health_engine",
        ruleId: `duplicate_relationship_group:${group
          .map((r) => r.id)
          .sort()
          .join(",")}`,
        severity: "warning",
        riskFlag: false,
        category: "knowledge_graph",
      }),
    );
  }

  for (const group of input.circularReferenceGroups) {
    const first = group[0];
    const node: KnowledgeNodeRef = { nodeType: first.source_node_type, nodeId: first.source_node_id };
    drafts.push(
      draftFromFinding({
        title: "Resolve circular reference",
        description: `A circular reference was found among ${group.length} relationship(s) starting at ${nodeLabel(node)}.`,
        node,
        generatedBy: "knowledge_health_engine",
        ruleId: `circular_reference:${group
          .map((r) => r.id)
          .sort()
          .join(",")}`,
        severity: "critical",
        riskFlag: true,
        category: "knowledge_graph",
      }),
    );
  }

  for (const doc of input.expiredDocuments) {
    const node: KnowledgeNodeRef = { nodeType: "document", nodeId: doc.id };
    drafts.push(
      draftFromFinding({
        title: `Review expired document: ${doc.title}`,
        description: `"${doc.title}" expired on ${doc.expires_at}.`,
        node,
        generatedBy: "workspace_health_engine",
        ruleId: "expired_document",
        severity: "warning",
        riskFlag: true,
        category: "documents",
      }),
    );
  }

  return drafts;
}
