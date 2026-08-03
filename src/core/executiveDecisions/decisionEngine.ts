import { computeReadinessPriorityContribution } from "@/core/executiveDecisions/priorityEngine";
import type { KnowledgeNodeRef, KnowledgeNodeType } from "@/types/knowledgeGraph";
import type { Decision, DecisionDependency, DecisionStatus, ReadinessResolution, ReadinessSource } from "@/types/executiveDecisions";
import type { ObjectiveStatus } from "@/types/objectives";
import type { BusinessRuleViolation } from "@/types/businessHealth";

/**
 * v2.0 Checkpoint 25.7, Step 7 — Decision dependency evaluation and
 * status-transition validity. Mirrors `objectiveEngine.ts`'s (Step 15.6)
 * exact pattern and reuses the same underlying predicates (an objective's
 * own status, `businessRuleEngine.ts`'s violations, the `existingNodeKeys`
 * convention `knowledgeHealthEngine.ts` established) — the mirroring is
 * deliberate reuse-by-pattern, not duplicated business logic: every
 * predicate here answers a question some other engine already owns the
 * answer to.
 */

export interface DecisionDependencyContext {
  decisionStatusById: Map<string, DecisionStatus>;
  objectiveStatusById: Map<string, ObjectiveStatus>;
  /** For `kind: "asset" | "event" | "client" | "document"` — same `${nodeType}:${nodeId}` existence convention as `objectiveEngine.ts`. */
  existingNodeKeys: Set<string>;
  /** For `kind: "relationship"` — the id of every still-active `KnowledgeRelationship`. */
  activeRelationshipIds: Set<string>;
  /** For `kind: "timeline_activity"`. */
  existingTimelineActivityIds: Set<string>;
  businessRuleViolations: BusinessRuleViolation[];
  approvalFlags: Record<string, boolean>;
}

export interface DecisionDependencyEvaluation {
  dependency: DecisionDependency;
  satisfied: boolean;
  detail: string;
}

function nodeKey(node: KnowledgeNodeRef): string {
  return `${node.nodeType}:${node.nodeId}`;
}

export function evaluateDecisionDependencies(dependencies: DecisionDependency[], context: DecisionDependencyContext): DecisionDependencyEvaluation[] {
  return dependencies.map((dependency): DecisionDependencyEvaluation => {
    switch (dependency.kind) {
      case "decision": {
        const status = dependency.targetDecisionId ? context.decisionStatusById.get(dependency.targetDecisionId) : undefined;
        const satisfied = status === "resolved";
        return { dependency, satisfied, detail: satisfied ? dependency.description : `${dependency.description} (depends on a decision that is not yet resolved.)` };
      }
      case "objective": {
        const status = dependency.targetObjectiveId ? context.objectiveStatusById.get(dependency.targetObjectiveId) : undefined;
        const satisfied = status === "completed";
        return { dependency, satisfied, detail: satisfied ? dependency.description : `${dependency.description} (depends on an objective that is not yet completed.)` };
      }
      case "business_rule": {
        const satisfied = !context.businessRuleViolations.some((v) => v.ruleId === dependency.businessRuleId);
        return { dependency, satisfied, detail: satisfied ? dependency.description : `${dependency.description} (business rule still violated.)` };
      }
      case "approval": {
        const satisfied = dependency.approvalKey !== null && context.approvalFlags[dependency.approvalKey] === true;
        return { dependency, satisfied, detail: dependency.description };
      }
      case "relationship": {
        const relationshipId = dependency.targetNode?.nodeId ?? null;
        const satisfied = relationshipId !== null && context.activeRelationshipIds.has(relationshipId);
        return { dependency, satisfied, detail: satisfied ? dependency.description : `${dependency.description} (the relationship is no longer active.)` };
      }
      case "timeline_activity": {
        const satisfied = dependency.timelineActivityId !== null && context.existingTimelineActivityIds.has(dependency.timelineActivityId);
        return { dependency, satisfied, detail: satisfied ? dependency.description : `${dependency.description} (the referenced Timeline activity was not found.)` };
      }
      case "asset":
      case "event":
      case "client":
      case "document": {
        const satisfied = dependency.targetNode !== null && context.existingNodeKeys.has(nodeKey(dependency.targetNode));
        return { dependency, satisfied, detail: satisfied ? dependency.description : `${dependency.description} (referenced record no longer exists.)` };
      }
    }
  });
}

export interface DecisionStatusTransitionCheck {
  allowed: boolean;
  blockingReasons: string[];
}

/** Only `resolved` is gated — the same "only claiming done is a false statement if something is unmet" rule `objectiveEngine.validateStatusTransition` applies. */
export function validateDecisionStatusTransition(nextStatus: DecisionStatus, dependencyEvaluations: DecisionDependencyEvaluation[]): DecisionStatusTransitionCheck {
  if (nextStatus !== "resolved") return { allowed: true, blockingReasons: [] };

  const blockingReasons = dependencyEvaluations.filter((d) => !d.satisfied).map((d) => d.detail);
  return { allowed: blockingReasons.length === 0, blockingReasons };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days elapsed since `createdAt`, floored — `now` is always caller-supplied so this stays a pure, deterministically-testable function, never `Date.now()` internally. */
export function deriveDecisionAgeDays(createdAt: string, now: string): number {
  return Math.max(0, Math.floor((new Date(now).getTime() - new Date(createdAt).getTime()) / MS_PER_DAY));
}

/**
 * v2.0 Checkpoint 25.7 Closing Fix — Readiness Resolution. Picks the most
 * appropriate *already-computed* readiness value for a Decision — never a
 * new readiness calculation. The caller (`executiveDecisionsActions.ts`)
 * builds these lookup maps once per evaluation from data it already
 * fetched: `ReadinessScore.overallScore` per proposal/event/client/vendor
 * (Step 15.5's `evaluateBusinessHealthAction`), `ObjectiveProgress.completionPercent`
 * per objective (Step 15.6's `evaluateObjectivesAction`), and
 * `BusinessHealthReport.overallScore` (Step 15.5) for the workspace tier.
 */
export interface ReadinessLookupContext {
  proposalReadinessByNodeId: Map<string, number>;
  eventReadinessByNodeId: Map<string, number>;
  clientReadinessByNodeId: Map<string, number>;
  vendorReadinessByNodeId: Map<string, number>;
  /** Keyed by Objective id, not node id — an Objective's own `ProgressEngine.completionPercent` (Step 15.6) is the readiness proxy for anything tied to that Objective. */
  objectiveProgressById: Map<string, number>;
  /** `BusinessHealthReport.overallScore` (Step 15.5) — the workspace-wide fallback tier, itself a real computed signal, not a placeholder. */
  businessHealthOverallScore: number;
}

/**
 * A Decision with no valid readiness source (its `related_entities` name
 * a node type `ReadinessEngine` has never evaluated — `media_asset`,
 * `document`, `contract`, `invoice`, `media_folder`, and so on) gets this
 * exact value, not 0. 0 on the 0-100 readiness scale means "completely
 * unready" everywhere else this scale is used (`ReadinessScore.overallScore`,
 * `ObjectiveProgress.completionPercent`) — silently assigning it to a
 * Decision this engine simply has no opinion about would fabricate a
 * false "this is in the worst possible state" signal and inflate its
 * priority for no real reason. 50 — the scale's midpoint — reads as
 * "unknown," not "unready" or "ready," and is `isFallback: true` in the
 * returned `ReadinessResolution` so this is never confused with a real
 * measurement.
 */
export const READINESS_NEUTRAL_FALLBACK = 50;

const ENTITY_READINESS_LOOKUPS: { nodeType: KnowledgeNodeType; source: ReadinessSource; mapKey: keyof ReadinessLookupContext }[] = [
  { nodeType: "proposal", source: "proposal", mapKey: "proposalReadinessByNodeId" },
  { nodeType: "event", source: "event", mapKey: "eventReadinessByNodeId" },
  { nodeType: "client", source: "client", mapKey: "clientReadinessByNodeId" },
  { nodeType: "vendor", source: "vendor", mapKey: "vendorReadinessByNodeId" },
];

function finalizeResolution(source: ReadinessSource, value: number, isFallback: boolean): ReadinessResolution {
  return { source, value, isFallback, priorityContribution: computeReadinessPriorityContribution(value) };
}

/**
 * Preference order, most specific first: entity-level readiness for a
 * supported entity among `related_entities` (Proposal/Event/Client/
 * Vendor) → the readiness of a linked Objective → the workspace-wide
 * Business Health score when the Decision is workspace-scoped (no
 * `related_entities`, or one explicitly typed `"workspace"`) → the
 * documented neutral fallback for anything else.
 */
export function resolveDecisionReadiness(decision: Pick<Decision, "related_entities" | "related_objective_ids">, context: ReadinessLookupContext): ReadinessResolution {
  for (const node of decision.related_entities) {
    const lookup = ENTITY_READINESS_LOOKUPS.find((l) => l.nodeType === node.nodeType);
    if (!lookup) continue;
    const map = context[lookup.mapKey] as Map<string, number>;
    if (map.has(node.nodeId)) return finalizeResolution(lookup.source, map.get(node.nodeId)!, false);
  }

  for (const objectiveId of decision.related_objective_ids) {
    if (context.objectiveProgressById.has(objectiveId)) {
      return finalizeResolution("objective", context.objectiveProgressById.get(objectiveId)!, false);
    }
  }

  const isWorkspaceScoped = decision.related_entities.length === 0 || decision.related_entities.some((n) => n.nodeType === "workspace");
  if (isWorkspaceScoped) return finalizeResolution("workspace", context.businessHealthOverallScore, false);

  return finalizeResolution("fallback", READINESS_NEUTRAL_FALLBACK, true);
}
