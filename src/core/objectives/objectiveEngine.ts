import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { Objective, ObjectiveDependency, ObjectiveEffectiveStatus, ObjectiveProgress, ObjectiveStatus } from "@/types/objectives";
import type { BusinessRuleViolation } from "@/types/businessHealth";

/**
 * v2.0 Checkpoint 25, Step 15.6 — Objective Engine. Owns the two things
 * `progressEngine.ts` deliberately doesn't: dependency satisfaction (an
 * objective's `dependencies`, not its `requirements`) and status-transition
 * validity. Pure, deterministic — no data access, no re-detection of
 * anything `businessRuleEngine.ts`/`knowledgeHealthEngine.ts` already
 * compute.
 */

export interface DependencyContext {
  /** For `kind: "objective"` dependencies — the caller resolves every referenced objective's own `status` once, up front. */
  objectiveStatusById: Map<string, ObjectiveStatus>;
  /** For `kind: "knowledge_relationship" | "asset" | "collection" | "client" | "event"` — the exact `existingNodeKeys` convention `knowledgeHealthEngine`/`orphanDetectionEngine` already use (`${nodeType}:${nodeId}`). */
  existingNodeKeys: Set<string>;
  /** For `kind: "business_rule"`. */
  businessRuleViolations: BusinessRuleViolation[];
  /** For `kind: "approval"` — same flag bag `progressEngine.ts`'s `required_approvals` requirement reads. */
  approvalFlags: Record<string, boolean>;
}

export interface DependencyEvaluation {
  dependency: ObjectiveDependency;
  satisfied: boolean;
  detail: string;
}

function nodeKey(node: KnowledgeNodeRef): string {
  return `${node.nodeType}:${node.nodeId}`;
}

export function evaluateDependencies(dependencies: ObjectiveDependency[], context: DependencyContext): DependencyEvaluation[] {
  return dependencies.map((dependency): DependencyEvaluation => {
    switch (dependency.kind) {
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
      case "knowledge_relationship":
      case "asset":
      case "collection":
      case "client":
      case "event": {
        const satisfied = dependency.targetNode !== null && context.existingNodeKeys.has(nodeKey(dependency.targetNode));
        return { dependency, satisfied, detail: satisfied ? dependency.description : `${dependency.description} (referenced record no longer exists.)` };
      }
    }
  });
}

/** "Overdue" is never stored — see `types/objectives.ts`'s own doc comment on `ObjectiveStatus`. Derived fresh from `due_date` every time it's needed, using a caller-supplied `now` so this stays a pure, deterministically-testable function (never `Date.now()` internally). */
export function deriveEffectiveStatus(objective: Pick<Objective, "status" | "due_date">, now: string): ObjectiveEffectiveStatus {
  if (objective.status === "completed" || objective.status === "archived") return objective.status;
  if (objective.due_date !== null && new Date(objective.due_date).getTime() < new Date(now).getTime()) return "overdue";
  return objective.status;
}

export interface StatusTransitionCheck {
  allowed: boolean;
  blockingReasons: string[];
}

/** Only `completed` has a gate — every other transition (starting, blocking, reopening, archiving) is always allowed, since only "done" makes a false claim if requirements/dependencies aren't actually met. */
export function validateStatusTransition(nextStatus: ObjectiveStatus, progress: ObjectiveProgress, dependencyEvaluations: DependencyEvaluation[]): StatusTransitionCheck {
  if (nextStatus !== "completed") return { allowed: true, blockingReasons: [] };

  const blockingReasons = [
    ...dependencyEvaluations.filter((d) => !d.satisfied).map((d) => d.detail),
    ...(progress.completionPercent < 100 ? [`Completion is ${progress.completionPercent}%, not 100%.`] : []),
  ];
  return { allowed: blockingReasons.length === 0, blockingReasons };
}
