import type { KnowledgeNodeRef, KnowledgeNodeType } from "@/types/knowledgeGraph";

/**
 * v2.0 Checkpoint 25, Step 15.5 — Operational Intelligence Layer. Shared
 * types for the Business Health Engine and everything built on top of it.
 * Every score/status here is computed by a deterministic engine over
 * already-fetched data — nothing in this file or the engines that produce
 * these values calls an AI provider.
 */

export const HEALTH_CATEGORIES = [
  "relationship_health",
  "asset_health",
  "documentation_health",
  "proposal_completeness",
  "client_completeness",
  "event_readiness",
  "vendor_readiness",
  "workflow_readiness",
  "communication_health",
  "knowledge_health",
  "dependency_health",
  // v2.0 Checkpoint 40 — Global Search & Universal Command Center. Same
  // "optional input, notApplicable until supplied" precedent `workflow_readiness`
  // established for Checkpoint 39.
  "search_health",
  // v2 Checkpoint 44 — Client Documents & Digital Client Experience. Same
  // "optional input, notApplicable until supplied" precedent as
  // `workflow_readiness`/`search_health`/`communication_health`. Distinct
  // from `documentation_health` above (the pre-Checkpoint-12 file-storage
  // `Document`) — this scores the Document Platform's own generated
  // `ComposedDocument`/`DocumentBundle` entities.
  "document_platform_health",
] as const;
export type HealthCategory = (typeof HEALTH_CATEGORIES)[number];

export const HEALTH_CATEGORY_LABELS: Record<HealthCategory, string> = {
  relationship_health: "Relationship Health",
  asset_health: "Asset Health",
  documentation_health: "Documentation Health",
  proposal_completeness: "Proposal Completeness",
  client_completeness: "Client Completeness",
  event_readiness: "Event Readiness",
  vendor_readiness: "Vendor Readiness",
  workflow_readiness: "Workflow Readiness",
  communication_health: "Communication Health",
  knowledge_health: "Knowledge Health",
  dependency_health: "Dependency Health",
  search_health: "Search Health",
  document_platform_health: "Document Platform Health",
};

export interface HealthCategoryScore {
  category: HealthCategory;
  /** 0–100. `null` when this category has no computable data this checkpoint (see `notApplicableReason`) rather than a fabricated number. */
  score: number | null;
  issues: string[];
  notApplicableReason: string | null;
}

export type RecommendationSeverity = "critical" | "warning" | "info";

/** "Recommendations must always reference the exact business rule that generated them" (spec) — `ruleId` is never optional. */
export interface OperationalRecommendation {
  ruleId: string;
  message: string;
  severity: RecommendationSeverity;
  node: KnowledgeNodeRef;
}

export interface BusinessRuleViolation {
  ruleId: string;
  description: string;
  node: KnowledgeNodeRef;
  severity: "hard" | "soft";
}

export interface ReadinessScore {
  node: KnowledgeNodeRef;
  overallScore: number;
  missingRequirements: string[];
  warnings: string[];
  blockingIssues: string[];
  suggestedNextSteps: OperationalRecommendation[];
  lastEvaluatedAt: string;
}

export interface CompletenessResult {
  missingRequirements: string[];
  score: number;
}

export interface WorkspaceHealthReport {
  assetsWithoutOwners: number;
  brokenRelationships: number;
  missingRequiredRelationships: number;
  invalidConstraints: number;
  expiredDocuments: number;
  archivedAssetsStillReferenced: number;
  duplicateRelationshipGroups: number;
  /** Always 0 with a disclosure — see `docs/business-health-engine.md`'s Known Limitations; "Unused Templates" refers to the separate Document Intelligence Platform, out of scope for the Knowledge Graph. */
  unusedTemplates: number;
  incompleteProposals: number;
  incompleteEvents: number;
  overdueApprovals: number;
  pendingDependencies: number;
}

export interface BusinessHealthReport {
  categories: HealthCategoryScore[];
  overallScore: number;
  evaluatedAt: string;
}

export const READINESS_NODE_TYPES = ["client", "proposal", "invoice", "event", "vendor", "workspace", "media_asset", "media_collection"] as const satisfies readonly KnowledgeNodeType[];
export type ReadinessNodeType = (typeof READINESS_NODE_TYPES)[number];
