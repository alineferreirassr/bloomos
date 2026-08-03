import { DECISION_PRIORITIES, type Decision, type DecisionPriority } from "@/types/executiveDecisions";
import type { ObjectiveStatus } from "@/types/objectives";

/**
 * v2.0 Checkpoint 25.7, Step 10 — Escalation Engine. A declarative,
 * data-only rule registry (same "one-line addition, never a new code
 * path" shape as `relationshipConstraintsRegistry.ts`, Step 10.7) — every
 * rule is a set of AND-combined conditions over a `Decision` plus context
 * the caller already computed, never a new detector.
 *
 * "Business rule repeatedly violated" / "relationship repeatedly broken" /
 * "dependency repeatedly failing" have no persisted occurrence-counter
 * anywhere in this checkpoint's `Decision` fields (the spec's own Step 3
 * field list doesn't name one). The honest, available proxy for
 * "recurred" is that `decisionsStore.upsertDecision` returns the *same*
 * still-open Decision on every evaluation where the underlying issue is
 * detected again — so a Decision surviving past `minAgeDays` while still
 * open already means the issue was independently re-detected on a later
 * evaluation, which is what "repeatedly" means here. This is disclosed,
 * not hidden — see `docs/executive-decision-engine.md`.
 */

export interface EscalationRule {
  id: string;
  description: string;
  /** `null` = no priority requirement; otherwise the Decision's priority must be at or above this. */
  priorityAtLeast: DecisionPriority | null;
  /** `null` = no age requirement. */
  minAgeDays: number | null;
  requiresObjectiveBlocked: boolean;
  requiresUnmetDependency: boolean;
  /** Matches when `decision.generated_by` or `decision.reason` starts with this string; `null` = no restriction. */
  generatedByPrefix: string | null;
}

export const ESCALATION_RULES: EscalationRule[] = [
  {
    id: "critical_unresolved",
    description: "A Critical decision has stayed open past the configured threshold.",
    priorityAtLeast: "critical",
    minAgeDays: 3,
    requiresObjectiveBlocked: false,
    requiresUnmetDependency: false,
    generatedByPrefix: null,
  },
  {
    id: "objective_blocked",
    description: "A linked Objective is blocked.",
    priorityAtLeast: null,
    minAgeDays: null,
    requiresObjectiveBlocked: true,
    requiresUnmetDependency: false,
    generatedByPrefix: null,
  },
  {
    id: "recurring_business_rule_violation",
    description: "A Business Rule violation has recurred across multiple evaluations.",
    priorityAtLeast: null,
    minAgeDays: 1,
    requiresObjectiveBlocked: false,
    requiresUnmetDependency: false,
    generatedByPrefix: "business_rule_engine",
  },
  {
    id: "recurring_broken_relationship",
    description: "A broken relationship has recurred across multiple evaluations.",
    priorityAtLeast: null,
    minAgeDays: 1,
    requiresObjectiveBlocked: false,
    requiresUnmetDependency: false,
    generatedByPrefix: "knowledge_health_engine:broken_relationship",
  },
  {
    id: "recurring_dependency_failure",
    description: "A dependency has repeatedly failed to resolve.",
    priorityAtLeast: null,
    minAgeDays: 2,
    requiresObjectiveBlocked: false,
    requiresUnmetDependency: true,
    generatedByPrefix: null,
  },
];

export interface EscalationContext {
  ageDays: number;
  relatedObjectiveStatuses: ObjectiveStatus[];
  unmetDependencyCount: number;
}

export interface EscalationEvaluation {
  rule: EscalationRule;
  triggered: boolean;
}

const PRIORITY_RANK: Record<DecisionPriority, number> = Object.fromEntries(DECISION_PRIORITIES.map((p, i) => [p, DECISION_PRIORITIES.length - i])) as Record<DecisionPriority, number>;

function meetsRule(rule: EscalationRule, decision: Decision, context: EscalationContext): boolean {
  if (rule.priorityAtLeast !== null && PRIORITY_RANK[decision.priority] < PRIORITY_RANK[rule.priorityAtLeast]) return false;
  if (rule.minAgeDays !== null && context.ageDays < rule.minAgeDays) return false;
  if (rule.requiresObjectiveBlocked && !context.relatedObjectiveStatuses.some((s) => s === "blocked")) return false;
  if (rule.requiresUnmetDependency && context.unmetDependencyCount === 0) return false;
  if (rule.generatedByPrefix !== null && !decision.generated_by.startsWith(rule.generatedByPrefix) && !decision.reason.startsWith(rule.generatedByPrefix)) return false;
  return true;
}

export function evaluateEscalation(decision: Decision, context: EscalationContext, rules: EscalationRule[] = ESCALATION_RULES): EscalationEvaluation[] {
  return rules.map((rule) => ({ rule, triggered: meetsRule(rule, decision, context) }));
}

export function shouldEscalate(decision: Decision, context: EscalationContext, rules: EscalationRule[] = ESCALATION_RULES): boolean {
  return evaluateEscalation(decision, context, rules).some((e) => e.triggered);
}
