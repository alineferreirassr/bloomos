import type { KnowledgeHealthReport } from "@/core/knowledge/knowledgeHealthEngine";
import type { WorkspaceHealthReport } from "@/types/businessHealth";
import type { BusinessHealthReport, CompletenessResult, HealthCategory, HealthCategoryScore } from "@/types/businessHealth";
import type { WorkspaceWorkflowHealthSummary } from "@/types/workflowMonitoring";
import type { SearchHealthReport } from "@/types/searchHealth";
import type { NotificationHealthReport } from "@/types/notificationHealth";
import type { DocumentPlatformHealthSummary } from "@/types/documentPlatform";

/**
 * v2.0 Checkpoint 25, Step 15.5 — Business Health Engine, the top-level
 * orchestrator the spec calls for. It detects nothing itself: every input
 * is a report or result already computed by an existing engine
 * (`knowledgeHealthEngine` Step 12, `workspaceHealthEngine` above,
 * `completenessEngine` earlier this checkpoint) — this file only converts
 * those into the 11 named `HealthCategory` scores and averages them.
 *
 * `communication_health` was `notApplicable` through Checkpoint 40 —
 * Checkpoint 24's Communication Platform (threads/messages/comments/
 * announcements) was a separate domain not wired into the Knowledge Graph.
 * v2.0 Checkpoint 41's Notification Center closes that gap the same way
 * Checkpoint 39/40 closed `workflow_readiness`/`search_health`: when a
 * caller supplies `notificationHealth` (`core/notifications/notificationHealthEngine.ts`'s
 * own `NotificationHealthReport`), this category scores for real. It's
 * honestly scoped to the Notification domain specifically, not the whole
 * Communication Platform — Comments/Presence/Internal Messaging still have
 * no Knowledge Graph wiring of their own, so a future checkpoint closing
 * *that* gap would extend this composite further, not duplicate it.
 *
 * `workflow_readiness` was `notApplicable` through Checkpoint 25 — no
 * `relationshipConstraintsRegistry.ts` rule and no `completenessEngine.ts`
 * evaluator targeted the `"workflow"` node type. v2.0 Checkpoint 39's
 * Workflow Monitoring Center closes that gap: when a caller supplies
 * `workflowHealth` (`core/workflowMonitoring/healthEngine.ts`'s own
 * `WorkspaceWorkflowHealthSummary`), this category scores for real —
 * that engine's own `averageScore`, never recomputed here. Omitting
 * `workflowHealth` keeps the exact `notApplicable` behavior every caller
 * before Checkpoint 39 already relies on.
 */

function averageScore(results: CompletenessResult[]): number | null {
  if (results.length === 0) return null;
  return Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
}

function categoryFromCompleteness(category: HealthCategory, results: CompletenessResult[], notApplicableReason: string): HealthCategoryScore {
  const score = averageScore(results);
  if (score === null) return { category, score: null, issues: [], notApplicableReason };
  return { category, score, issues: Array.from(new Set(results.flatMap((r) => r.missingRequirements))), notApplicableReason: null };
}

function categoryFromRatio(category: HealthCategory, issueCount: number, total: number, issues: string[], notApplicableReason: string): HealthCategoryScore {
  if (total === 0) return { category, score: null, issues: [], notApplicableReason };
  return { category, score: Math.max(0, Math.round(100 - (issueCount / total) * 100)), issues, notApplicableReason: null };
}

/** Unlike `categoryFromRatio`, the penalty is weighted by the underlying counts, not by how many distinct issue *messages* were generated — two missing relationships must weigh more than one, even though both collapse into a single summary string in `issues`. */
function categoryFromWeightedPenalty(category: HealthCategory, issues: string[], penalty: number): HealthCategoryScore {
  return { category, score: Math.max(0, 100 - penalty), issues, notApplicableReason: null };
}

function notApplicableCategory(category: HealthCategory, reason: string): HealthCategoryScore {
  return { category, score: null, issues: [], notApplicableReason: reason };
}

export interface ComputeBusinessHealthInput {
  knowledgeHealth: KnowledgeHealthReport;
  workspaceHealth: WorkspaceHealthReport;
  /** Total active relationships / nodes checked / assets / documents in the workspace, for ratio-based scoring — the engine never fetches these itself. */
  totalRelationships: number;
  totalNodesValidated: number;
  totalAssets: number;
  totalDocuments: number;
  proposalCompleteness: CompletenessResult[];
  clientCompleteness: CompletenessResult[];
  eventCompleteness: CompletenessResult[];
  vendorCompleteness: CompletenessResult[];
  /** v2.0 Checkpoint 39 — optional so every pre-Checkpoint-39 call site keeps compiling unchanged; see this file's own doc comment for what supplying it does. */
  workflowHealth?: WorkspaceWorkflowHealthSummary | null;
  /** v2.0 Checkpoint 40 — optional so every pre-Checkpoint-40 call site keeps compiling unchanged; see `core/search/searchHealthEngine.ts`'s own `computeSearchHealth()`. */
  searchHealth?: SearchHealthReport | null;
  /** v2.0 Checkpoint 41 — optional so every pre-Checkpoint-41 call site keeps compiling unchanged; see `core/notifications/notificationHealthEngine.ts`'s own `computeNotificationHealth()`. */
  notificationHealth?: NotificationHealthReport | null;
  /** v2 Checkpoint 44 — optional so every pre-Checkpoint-44 call site keeps compiling unchanged; see `core/documents/documentHealthEngine.ts`'s own `summarizeDocumentPlatformHealth()`. */
  documentPlatformHealth?: DocumentPlatformHealthSummary | null;
  /** Injected rather than read from `Date.now()`, keeping this a pure, deterministically-testable function. */
  evaluatedAt: string;
}

export function computeBusinessHealth(input: ComputeBusinessHealthInput): BusinessHealthReport {
  const relationshipIssues = [
    ...(input.knowledgeHealth.brokenRelationships.length > 0 ? [`${input.knowledgeHealth.brokenRelationships.length} broken relationship(s)`] : []),
    ...(input.knowledgeHealth.duplicateRelationshipGroups.length > 0 ? [`${input.knowledgeHealth.duplicateRelationshipGroups.length} duplicate relationship group(s)`] : []),
    ...(input.knowledgeHealth.circularReferenceGroups.length > 0 ? [`${input.knowledgeHealth.circularReferenceGroups.length} circular reference group(s)`] : []),
  ];
  const relationshipIssueCount = input.knowledgeHealth.brokenRelationships.length + input.knowledgeHealth.duplicateRelationshipGroups.length + input.knowledgeHealth.circularReferenceGroups.length;

  const knowledgeIssues = input.knowledgeHealth.constraintViolations.map((v) => v.message);

  const dependencyIssues = [
    ...(input.workspaceHealth.missingRequiredRelationships > 0 ? [`${input.workspaceHealth.missingRequiredRelationships} missing required relationship(s)`] : []),
    ...(input.workspaceHealth.pendingDependencies > 0 ? [`${input.workspaceHealth.pendingDependencies} pending dependency asset(s)`] : []),
  ];

  const assetIssues = input.knowledgeHealth.orphanedAssets.map((f) => f.detail);
  const documentationIssues = input.workspaceHealth.expiredDocuments > 0 ? [`${input.workspaceHealth.expiredDocuments} expired document(s)`] : [];

  const categories: HealthCategoryScore[] = [
    categoryFromRatio("relationship_health", relationshipIssueCount, input.totalRelationships, relationshipIssues, "No relationships recorded yet."),
    categoryFromRatio("asset_health", input.knowledgeHealth.orphanedAssets.length, input.totalAssets, assetIssues, "No assets recorded yet."),
    categoryFromRatio("documentation_health", input.workspaceHealth.expiredDocuments, input.totalDocuments, documentationIssues, "No documents recorded yet."),
    categoryFromCompleteness("proposal_completeness", input.proposalCompleteness, "No proposals to evaluate yet."),
    categoryFromCompleteness("client_completeness", input.clientCompleteness, "No clients to evaluate yet."),
    categoryFromCompleteness("event_readiness", input.eventCompleteness, "No events to evaluate yet."),
    categoryFromCompleteness("vendor_readiness", input.vendorCompleteness, "No vendors to evaluate yet."),
    input.workflowHealth && input.workflowHealth.averageScore !== null
      ? {
          category: "workflow_readiness",
          score: input.workflowHealth.averageScore,
          issues: input.workflowHealth.reports.flatMap((report) => [...report.structuralIssues.map((issue) => issue.message), ...report.findings.map((finding) => finding.message)]),
          notApplicableReason: null,
        }
      : notApplicableCategory("workflow_readiness", "No workflows recorded yet, or Workflow Health (Checkpoint 39) wasn't supplied to this computation."),
    input.searchHealth
      ? {
          category: "search_health",
          score: input.searchHealth.overallScore,
          issues: input.searchHealth.categories.flatMap((category) => category.issues),
          notApplicableReason: null,
        }
      : notApplicableCategory("search_health", "Search Health (Checkpoint 40) wasn't supplied to this computation."),
    input.notificationHealth
      ? {
          category: "communication_health",
          score: input.notificationHealth.overallScore,
          issues: input.notificationHealth.categories.flatMap((category) => category.issues),
          notApplicableReason: null,
        }
      : notApplicableCategory("communication_health", "Notification Health (Checkpoint 41) wasn't supplied to this computation."),
    input.documentPlatformHealth && input.documentPlatformHealth.overallScore !== null
      ? { category: "document_platform_health", score: input.documentPlatformHealth.overallScore, issues: input.documentPlatformHealth.issues, notApplicableReason: null }
      : notApplicableCategory("document_platform_health", "No Documents or Document Bundles recorded yet, or Document Platform Health (v2 Checkpoint 44) wasn't supplied to this computation."),
    categoryFromRatio("knowledge_health", input.knowledgeHealth.constraintViolations.length, input.totalNodesValidated, knowledgeIssues, "No nodes evaluated for constraint compliance yet."),
    categoryFromWeightedPenalty(
      "dependency_health",
      dependencyIssues,
      input.workspaceHealth.missingRequiredRelationships * 10 + input.workspaceHealth.pendingDependencies * 5,
    ),
  ];

  const scored = categories.filter((c): c is HealthCategoryScore & { score: number } => c.score !== null);
  const overallScore = scored.length === 0 ? 0 : Math.round(scored.reduce((sum, c) => sum + c.score, 0) / scored.length);

  return { categories, overallScore, evaluatedAt: input.evaluatedAt };
}
