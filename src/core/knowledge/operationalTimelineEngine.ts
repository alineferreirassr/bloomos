import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { BusinessHealthReport, BusinessRuleViolation, ReadinessScore } from "@/types/businessHealth";
import type { ConstraintViolation } from "@/types/relationshipConstraints";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";
import type { BusinessHealthSnapshot, ReadinessSnapshotRecord } from "@/lib/data/mock/businessHealthSnapshotsStore";

/**
 * v2.0 Checkpoint 25, Step 15.5 — Operational Timeline Integration. Pure
 * diffing only: every function here compares an already-computed "before"
 * against an already-computed "after" (a `BusinessHealthSnapshot`, a
 * `ReadinessScore`, a `ConstraintViolation[]`, a `BusinessRuleViolation[]`)
 * and returns the `OperationalTimelineEvent[]` that changed between them.
 * Nothing here recomputes health, readiness, or violations — those come
 * from `businessHealthEngine.ts`/`readinessEngine.ts`/
 * `relationshipConstraintsEngine.ts`/`businessRuleEngine.ts`. The module
 * layer (`businessHealthActions.ts`) is the only caller that has both a
 * "before" (read from `businessHealthSnapshotsStore.ts`) and an "after,"
 * and is responsible for turning each returned event into a real
 * `recordTimelineActivity` call.
 */

export interface OperationalTimelineEvent {
  type: TimelineActivityType;
  node: KnowledgeNodeRef;
  description: string;
}

/** No due-date-style field backs this — same disclosed-heuristic pattern as `workspaceHealthEngine.ts`'s `OVERDUE_APPROVAL_THRESHOLD_DAYS`. A score below this is a workspace worth flagging; crossing it (not just being below it) is what fires the event, so a workspace that's persistently unhealthy doesn't spam the Timeline on every single evaluation. */
const WORKSPACE_HEALTH_WARNING_THRESHOLD = 50;

export function diffBusinessHealth(workspaceId: string, previous: BusinessHealthSnapshot | null, current: BusinessHealthReport): OperationalTimelineEvent[] {
  const node: KnowledgeNodeRef = { nodeType: "workspace", nodeId: workspaceId };
  const events: OperationalTimelineEvent[] = [];

  if (previous !== null && current.overallScore !== previous.overallScore) {
    events.push({
      type: current.overallScore > previous.overallScore ? "operational_health_improved" : "operational_health_declined",
      node,
      description: `Workspace health score changed from ${previous.overallScore} to ${current.overallScore}.`,
    });
  }

  const wasWarning = previous !== null && previous.overallScore < WORKSPACE_HEALTH_WARNING_THRESHOLD;
  const isWarning = current.overallScore < WORKSPACE_HEALTH_WARNING_THRESHOLD;
  if (isWarning && !wasWarning) {
    events.push({
      type: "operational_workspace_warning",
      node,
      description: `Workspace health score (${current.overallScore}) has dropped below the ${WORKSPACE_HEALTH_WARNING_THRESHOLD} warning threshold.`,
    });
  }

  return events;
}

export function diffReadiness(previous: ReadinessSnapshotRecord | null, current: ReadinessScore): OperationalTimelineEvent[] {
  if (previous === null || previous.overallScore === current.overallScore) return [];
  return [
    {
      type: current.overallScore > previous.overallScore ? "operational_readiness_increased" : "operational_readiness_decreased",
      node: current.node,
      description: `Readiness score changed from ${previous.overallScore} to ${current.overallScore}.`,
    },
  ];
}

function constraintViolationKey(v: ConstraintViolation): string {
  return `${v.constraint.id}:${v.node.nodeType}:${v.node.nodeId}`;
}

/** A violation present in `current` but absent from `previous` is newly broken; one present in `previous` but absent from `current` was resolved since the last evaluation — a plain set diff, not a re-detection. */
export function diffConstraintViolations(previous: ConstraintViolation[], current: ConstraintViolation[]): OperationalTimelineEvent[] {
  const previousKeys = new Set(previous.map(constraintViolationKey));
  const currentKeys = new Set(current.map(constraintViolationKey));
  const events: OperationalTimelineEvent[] = [];

  for (const v of current) {
    if (!previousKeys.has(constraintViolationKey(v))) {
      events.push({ type: "operational_constraint_violated", node: v.node, description: v.message });
    }
  }
  for (const v of previous) {
    if (!currentKeys.has(constraintViolationKey(v))) {
      events.push({ type: "operational_constraint_fixed", node: v.node, description: `Resolved: ${v.message}` });
    }
  }

  return events;
}

/** Scoped to `circular_dependency` — the one `BusinessRuleViolation` the spec's own "Critical Dependency Detected" example names (a cycle in the dependency graph is the canonical "critical" case; other violations already get their own `operational_constraint_violated`/`_fixed` pair above). */
export function diffCriticalDependencies(previous: BusinessRuleViolation[], current: BusinessRuleViolation[]): OperationalTimelineEvent[] {
  const isCritical = (v: BusinessRuleViolation) => v.ruleId === "circular_dependency";
  const key = (v: BusinessRuleViolation) => `${v.ruleId}:${v.node.nodeType}:${v.node.nodeId}`;
  const previousKeys = new Set(previous.filter(isCritical).map(key));

  return current
    .filter(isCritical)
    .filter((v) => !previousKeys.has(key(v)))
    .map((v) => ({ type: "operational_critical_dependency_detected" as const, node: v.node, description: v.description }));
}
