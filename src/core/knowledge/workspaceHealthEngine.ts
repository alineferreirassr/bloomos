import { computeKnowledgeHealth, type ComputeKnowledgeHealthInput } from "@/core/knowledge/knowledgeHealthEngine";
import { getInboundRelationships, getOutboundRelationships } from "@/core/knowledge/graphTraversalEngine";
import type { CompletenessResult, WorkspaceHealthReport } from "@/types/businessHealth";
import type { Document } from "@/types/document";
import type { ProposalDraft } from "@/types/proposal";

/**
 * v2.0 Checkpoint 25, Step 15.5 — Workspace Health Engine. A pure
 * aggregation layer, same discipline as `knowledgeHealthEngine.ts`: every
 * count below is either read straight off `computeKnowledgeHealth`'s report
 * (Step 12 — never re-detected here) or derived from a field that already
 * exists on an established type. Nothing here re-implements orphan,
 * duplicate, broken-relationship, or constraint detection.
 */

/** Proposal review has no dedicated due-date field (unlike Document's `expires_at`) — this threshold is a disclosed, deliberate heuristic, not a business rule read off any record. See docs/workspace-health.md. */
const OVERDUE_APPROVAL_THRESHOLD_DAYS = 3;
const OVERDUE_APPROVAL_THRESHOLD_MS = OVERDUE_APPROVAL_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

export interface ComputeWorkspaceHealthInput extends ComputeKnowledgeHealthInput {
  documents: Document[];
  /** Pre-computed by the caller via `completenessEngine.ts`'s `evaluateProposalCompleteness`/`evaluateEventCompleteness` — this engine never fetches or re-evaluates completeness itself. */
  proposalCompleteness: CompletenessResult[];
  eventCompleteness: CompletenessResult[];
  proposals: Pick<ProposalDraft, "status" | "reviewed_at" | "generated_at">[];
  /** Injected rather than read from `Date.now()`, keeping this a pure, deterministically-testable function. */
  now: string;
}

export function computeWorkspaceHealth(input: ComputeWorkspaceHealthInput): WorkspaceHealthReport {
  const knowledgeHealth = computeKnowledgeHealth(input);

  const assetsWithoutOwners = knowledgeHealth.orphanedAssets.filter((f) => f.reason === "linked_to_deleted_entity").length;
  const archivedAssetsStillReferenced = knowledgeHealth.orphanedAssets.filter((f) => f.reason === "archived_but_referenced").length;
  const missingRequiredRelationships = knowledgeHealth.constraintViolations.filter((v) => v.constraint.minCount !== null && v.actualCount < v.constraint.minCount).length;

  const nowMs = new Date(input.now).getTime();
  const expiredDocuments = input.documents.filter((d) => d.expires_at !== null && new Date(d.expires_at).getTime() < nowMs).length;

  const incompleteProposals = input.proposalCompleteness.filter((c) => c.missingRequirements.length > 0).length;
  const incompleteEvents = input.eventCompleteness.filter((c) => c.missingRequirements.length > 0).length;

  const overdueApprovals = input.proposals.filter(
    (p) => p.status === "draft" && p.reviewed_at === null && nowMs - new Date(p.generated_at).getTime() > OVERDUE_APPROVAL_THRESHOLD_MS,
  ).length;

  const pendingDependencies = input.assets.filter((asset) => {
    if (asset.status !== "pending") return false;
    const node = { nodeType: "media_asset" as const, nodeId: asset.id };
    return getInboundRelationships(node, input.relationships).length > 0 || getOutboundRelationships(node, input.relationships).length > 0;
  }).length;

  return {
    assetsWithoutOwners,
    brokenRelationships: knowledgeHealth.brokenRelationships.length,
    missingRequiredRelationships,
    invalidConstraints: knowledgeHealth.constraintViolations.length,
    expiredDocuments,
    archivedAssetsStillReferenced,
    duplicateRelationshipGroups: knowledgeHealth.duplicateRelationshipGroups.length,
    // Disclosed, not detected: same rationale as `knowledgeHealthEngine.computeKnowledgeHealth`'s own
    // "unused_templates" `notApplicable` entry — "Template" here means the Document Intelligence
    // Platform's `ComposedDocument` system, which has no usage-tracking field, and is out of scope
    // for the Knowledge Graph.
    unusedTemplates: 0,
    incompleteProposals,
    incompleteEvents,
    overdueApprovals,
    pendingDependencies,
  };
}
