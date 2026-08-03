import { edgeCountsForRule } from "@/core/knowledge/relationshipConstraintsEngine";
import type { KnowledgeNodeRef, KnowledgeRelationship } from "@/types/knowledgeGraph";
import type { Objective, ObjectiveProgress, ObjectiveRequirement } from "@/types/objectives";
import type { BusinessRuleViolation } from "@/types/businessHealth";
import type { Comment } from "@/types/comment";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { MediaAssetMetadata } from "@/types/mediaAsset";

/**
 * v2.0 Checkpoint 25, Step 15.6 — Progress Engine. Pure, deterministic, no
 * data access — same discipline as every engine in this checkpoint. Every
 * requirement type is evaluated against an already-resolved
 * `RequirementContext`; this file never fetches a MediaAsset, a Comment,
 * or a Proposal itself. Graph-shaped requirements (`required_assets`/
 * `required_documents`/`required_deliverables`/`required_relationships`)
 * reuse `relationshipConstraintsEngine.edgeCountsForRule` (Step 10.7)
 * rather than re-deriving a second relationship-counting mechanism.
 */

export interface RequirementContext {
  /** Pre-filtered by the caller to this objective's own node — `getCommentsForOwner`/`readActivities` scoped calls, same "resolve once, pass down" pattern `businessHealthActions.ts` already established. */
  relationships: KnowledgeRelationship[];
  comments: Comment[];
  timelineActivities: TimelineActivity[];
  mediaMetadata: MediaAssetMetadata | null;
  mediaTags: string[] | null;
  /** Resolved by the caller into named booleans (e.g. `"proposal_reviewed"`, `"contract_signed"`, `"media_asset_approved"`) — this file never imports Proposal/Contract/MediaAsset status types. */
  approvalFlags: Record<string, boolean>;
  /** Pre-filtered to this objective's node. */
  businessRuleViolations: BusinessRuleViolation[];
}

function resolveMetadataFieldValue(metadata: MediaAssetMetadata, field: string): unknown {
  if (field in metadata && field !== "custom") return (metadata as unknown as Record<string, unknown>)[field];
  return metadata.custom[field];
}

interface RequirementResult {
  satisfied: boolean;
  detail: string;
}

function evaluateRequirement(node: KnowledgeNodeRef, requirement: ObjectiveRequirement, context: RequirementContext): RequirementResult {
  switch (requirement.type) {
    case "required_assets":
    case "required_documents":
    case "required_deliverables":
    case "required_relationships": {
      const count = edgeCountsForRule(node, requirement, context.relationships);
      const satisfied = count >= requirement.minCount;
      return { satisfied, detail: satisfied ? requirement.description : `${requirement.description} (found ${count}, requires at least ${requirement.minCount}.)` };
    }
    case "required_approvals": {
      const satisfied = context.approvalFlags[requirement.approvalKey] === true;
      return { satisfied, detail: requirement.description };
    }
    case "required_metadata": {
      const value = context.mediaMetadata ? resolveMetadataFieldValue(context.mediaMetadata, requirement.metadataField) : null;
      const satisfied = value !== null && value !== undefined && value !== "";
      return { satisfied, detail: requirement.description };
    }
    case "required_tags": {
      const tags = context.mediaTags ?? [];
      const satisfied = requirement.requiredTags.every((tag) => tags.includes(tag));
      const missing = requirement.requiredTags.filter((tag) => !tags.includes(tag));
      return { satisfied, detail: satisfied ? requirement.description : `${requirement.description} (missing: ${missing.join(", ")}.)` };
    }
    case "required_timeline_activity": {
      const count = context.timelineActivities.filter((a) => a.type === requirement.timelineActivityType).length;
      const satisfied = count >= requirement.minCount;
      return { satisfied, detail: satisfied ? requirement.description : `${requirement.description} (found ${count}, requires at least ${requirement.minCount}.)` };
    }
    case "required_communication": {
      const satisfied = context.comments.length >= requirement.minCommentCount;
      return { satisfied, detail: satisfied ? requirement.description : `${requirement.description} (found ${context.comments.length}, requires at least ${requirement.minCommentCount}.)` };
    }
    case "required_business_rules": {
      const matching = requirement.businessRuleId === null ? context.businessRuleViolations : context.businessRuleViolations.filter((v) => v.ruleId === requirement.businessRuleId);
      const satisfied = matching.length === 0;
      return { satisfied, detail: satisfied ? requirement.description : `${requirement.description} (${matching.length} violation(s) found.)` };
    }
  }
}

export function computeObjectiveProgress(objective: Objective, context: RequirementContext): ObjectiveProgress {
  if (objective.requirements.length === 0) {
    return { objectiveId: objective.id, completionPercent: 100, missingRequirements: [], blockingIssues: [], remainingTasks: [], estimatedProgress: 100 };
  }

  const node = objective.node ?? { nodeType: "workspace" as const, nodeId: objective.workspace_id };
  const results = objective.requirements.map((requirement) => ({ requirement, ...evaluateRequirement(node, requirement, context) }));
  const satisfiedCount = results.filter((r) => r.satisfied).length;
  const completionPercent = Math.round((satisfiedCount / results.length) * 100);
  const unmet = results.filter((r) => !r.satisfied);

  return {
    objectiveId: objective.id,
    completionPercent,
    missingRequirements: unmet.map((r) => r.detail),
    // Dependency-driven blocking issues are computed by `objectiveEngine.evaluateDependencies`, not here — this engine only ever looks at `objective.requirements`, never `objective.dependencies`, keeping the two concerns (completion vs. what's gating it) in separate, individually testable functions.
    blockingIssues: [],
    remainingTasks: unmet.map((r) => r.requirement.description),
    estimatedProgress: completionPercent,
  };
}
