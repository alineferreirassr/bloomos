import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";

/**
 * v2.0 Checkpoint 25.7 — Executive Decision Platform. A Decision is never
 * detected here — every Decision this layer creates is a translation of a
 * finding some earlier engine already computed (an `OperationalRecommendation`
 * from Step 15.5/15.6, a `KnowledgeHealthReport` finding from Step 12, an
 * expired `Document`). See `docs/executive-decision-engine.md` for the full
 * "why" behind every field and formula below.
 */

export const DECISION_PRIORITIES = ["critical", "high", "medium", "low", "informational"] as const;
export type DecisionPriority = (typeof DECISION_PRIORITIES)[number];

/** 5 stored values, same "definition vs. derived" split every status enum in this checkpoint uses — there is no persisted "escalated forever" flag; `escalated` is a status the Escalation Engine can move a Decision into, exactly like any other transition. */
export const DECISION_STATUSES = ["open", "in_progress", "resolved", "escalated", "archived"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const DECISION_CATEGORIES = [
  "operations",
  "finance",
  "crm",
  "assets",
  "events",
  "vendors",
  "compliance",
  "security",
  "documents",
  "approvals",
  "communication",
  "automation",
  "knowledge_graph",
  "objectives",
] as const;
export type DecisionCategory = (typeof DECISION_CATEGORIES)[number];

export const DECISION_CATEGORY_LABELS: Record<DecisionCategory, string> = {
  operations: "Operations",
  finance: "Finance",
  crm: "CRM",
  assets: "Assets",
  events: "Events",
  vendors: "Vendors",
  compliance: "Compliance",
  security: "Security",
  documents: "Documents",
  approvals: "Approvals",
  communication: "Communication",
  automation: "Automation",
  knowledge_graph: "Knowledge Graph",
  objectives: "Objectives",
};

/**
 * v2.0 Checkpoint 25.7 Closing Fix — traceability for the readiness value
 * `priorityEngine.ts`'s `DecisionFactors.operationalReadiness` actually
 * used for a given Decision. Not a new score — `readiness.value` is never
 * an 8th number averaged into `overallExecutiveScore`; it only explains
 * how the existing `computePriorityScore` composite arrived at its
 * result. See `docs/priority-engine.md`.
 */
export const READINESS_SOURCES = ["proposal", "event", "client", "vendor", "objective", "workspace", "fallback"] as const;
export type ReadinessSource = (typeof READINESS_SOURCES)[number];

export interface ReadinessResolution {
  source: ReadinessSource;
  /** 0-100, the readiness value actually applied — from `ReadinessScore.overallScore` (Step 15.5), `ObjectiveProgress.completionPercent` (Step 15.6), `BusinessHealthReport.overallScore` (Step 15.5), or the documented neutral fallback. */
  value: number;
  /** `true` only for `source: "fallback"` — every other source resolved a real, already-computed value. */
  isFallback: boolean;
  /** Points this readiness value contributed to `priorityEngine.computePriorityScore`'s 0-100 composite, per that file's own disclosed formula — answers "how did readiness affect the final score" without duplicating the formula here. */
  priorityContribution: number;
}

export interface DecisionScores {
  decisionScore: number;
  urgencyScore: number;
  businessImpactScore: number;
  dependencyScore: number;
  riskScore: number;
  complexityScore: number;
  confidence: number;
  overallExecutiveScore: number;
  readiness: ReadinessResolution;
}

export const DECISION_DEPENDENCY_KINDS = ["decision", "objective", "business_rule", "asset", "relationship", "event", "client", "document", "approval", "timeline_activity"] as const;
export type DecisionDependencyKind = (typeof DECISION_DEPENDENCY_KINDS)[number];

/** Same shape and satisfaction philosophy as `ObjectiveDependency` (Step 15.6) — a dependency never re-declares how it's satisfied, it only points at something whose satisfaction another engine already owns. */
export interface DecisionDependency {
  id: string;
  kind: DecisionDependencyKind;
  description: string;
  targetDecisionId: string | null;
  targetObjectiveId: string | null;
  targetNode: KnowledgeNodeRef | null;
  businessRuleId: string | null;
  approvalKey: string | null;
  timelineActivityId: string | null;
}

export interface Decision {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  category: DecisionCategory;
  priority: DecisionPriority;
  status: DecisionStatus;
  reason: string;
  /** A deterministic engine name, e.g. `"business_health_engine"` — never `"ai"`. Named `generated_by` (not `generatedByEngine`) to match the spec's own Step 3 field name exactly. */
  generated_by: string;
  created_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  related_entities: KnowledgeNodeRef[];
  related_assets: KnowledgeNodeRef[];
  related_objective_ids: string[];
  related_timeline_activity_ids: string[];
  dependencies: DecisionDependency[];
  /**
   * Not a spec-named field — a practical necessity this checkpoint's own
   * discipline requires: re-running `evaluateExecutiveDecisionsAction`
   * must never spawn a second Decision for the exact same underlying
   * issue. `dedupe_key` is a stable hash of (generated_by, source ruleId,
   * node) that `decisionsStore.ts`'s `upsertDecision` checks against every
   * still-open Decision before creating a new row — the same
   * "before/after" discipline Step 15.5's `businessHealthSnapshotsStore.ts`
   * uses, applied to identity instead of a score.
   */
  dedupe_key: string;
}

export interface WorkspaceExecutiveScorecard {
  operationalScore: number;
  businessScore: number;
  decisionScore: number;
  readinessScore: number;
  knowledgeScore: number;
  objectiveScore: number;
  overallExecutiveScore: number;
  evaluatedAt: string;
}

export interface TopEntry {
  node: KnowledgeNodeRef;
  label: string;
  count: number;
}

export interface ExecutiveInsights {
  mostImpactedClients: TopEntry[];
  mostBlockedObjectives: TopEntry[];
  mostCriticalAssets: TopEntry[];
  mostReferencedDocuments: TopEntry[];
  mostViolatedBusinessRules: { ruleId: string; count: number }[];
  mostOverloadedEvents: TopEntry[];
  /** Always empty, with a reason — no workflow health signal exists anywhere in this codebase (Step 15.5 already disclosed `workflow_readiness` as `notApplicable` for the identical reason). Listed here, not silently omitted, so a caller knows it was considered. */
  mostFragileWorkflows: { entries: TopEntry[]; notApplicableReason: string };
}

export interface ExecutiveReport {
  executiveSummary: string;
  criticalIssues: string[];
  businessRisks: string[];
  operationalRisks: string[];
  decisionQueueSummary: string;
  completedDecisionsSummary: string;
  blockedDecisionsSummary: string;
  topImprovements: string[];
  evaluatedAt: string;
}
