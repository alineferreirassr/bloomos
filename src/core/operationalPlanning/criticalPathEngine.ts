import type { ExecutionPhase, ExecutionStep, DependencyClass, CriticalPathResult } from "@/types/operationalPlanning";
import { flattenSteps } from "@/core/operationalPlanning/executionStepEngine";

/**
 * v2.0 Checkpoint 27.2, Step 12 — Critical Path Engine. Dependency
 * analysis only — a longest-path calculation over `estimated_duration_minutes`
 * and each `StepDependency.dependency_class`, never a scheduling
 * optimization (no calendar, no resource contention, no travel time).
 * Callers MUST confirm `detectDependencyCycle` (`executionStepEngine.ts`)
 * found no cycle first — this engine assumes an acyclic graph and doesn't
 * re-check, the same "don't duplicate a validation another engine already
 * owns" discipline every composed engine in this checkpoint follows.
 */

function buildIncomingClasses(steps: ExecutionStep[], stepIds: ReadonlySet<string>): Map<string, DependencyClass[]> {
  const incoming = new Map<string, DependencyClass[]>();
  for (const step of steps) {
    for (const dep of step.dependencies) {
      if (!stepIds.has(dep.step_id)) continue;
      const list = incoming.get(dep.step_id) ?? [];
      list.push(dep.dependency_class);
      incoming.set(dep.step_id, list);
    }
  }
  return incoming;
}

export function computeCriticalPath(phases: ExecutionPhase[]): CriticalPathResult {
  const steps = flattenSteps(phases);
  const stepById = new Map(steps.map((s) => [s.id, s] as const));
  const stepIds = new Set(stepById.keys());

  const memo = new Map<string, number>();
  function longestPathEndingAt(stepId: string): number {
    const cached = memo.get(stepId);
    if (cached !== undefined) return cached;
    const step = stepById.get(stepId);
    if (!step) return 0;
    let maxUpstream = 0;
    for (const dep of step.dependencies) {
      if (!stepIds.has(dep.step_id)) continue;
      maxUpstream = Math.max(maxUpstream, longestPathEndingAt(dep.step_id));
    }
    const total = maxUpstream + step.estimated_duration_minutes;
    memo.set(stepId, total);
    return total;
  }

  let estimatedCompletionMinutes = 0;
  for (const step of steps) estimatedCompletionMinutes = Math.max(estimatedCompletionMinutes, longestPathEndingAt(step.id));

  // Walk backward from every step that achieves the overall maximum, following whichever dependency contributed the longest upstream chain — the classic critical-path trace.
  const criticalStepIds = new Set<string>();
  for (const endpoint of steps) {
    if (longestPathEndingAt(endpoint.id) !== estimatedCompletionMinutes) continue;
    let current: ExecutionStep | undefined = endpoint;
    while (current) {
      criticalStepIds.add(current.id);
      const realDeps: typeof current.dependencies = current.dependencies.filter((d) => stepIds.has(d.step_id));
      if (realDeps.length === 0) break;
      let nextId: string | null = null;
      let bestLength = -1;
      for (const upstreamDep of realDeps) {
        const length = longestPathEndingAt(upstreamDep.step_id);
        if (length > bestLength) {
          bestLength = length;
          nextId = upstreamDep.step_id;
        }
      }
      current = nextId ? stepById.get(nextId) : undefined;
    }
  }

  const incomingClasses = buildIncomingClasses(steps, stepIds);
  const blockingStepIds = steps.filter((s) => (incomingClasses.get(s.id) ?? []).includes("blocking")).map((s) => s.id);
  /** A step whose every incoming reliance (every other step's dependency naming it) is `"optional"` — nothing critical or blocking rests on it. */
  const optionalStepIds = steps
    .filter((s) => {
      const classes = incomingClasses.get(s.id);
      return classes !== undefined && classes.length > 0 && classes.every((c) => c === "optional");
    })
    .map((s) => s.id);
  const optionalSet = new Set(optionalStepIds);
  const parallelStepIds = steps.filter((s) => !criticalStepIds.has(s.id) && !optionalSet.has(s.id)).map((s) => s.id);

  return { criticalStepIds: Array.from(criticalStepIds), blockingStepIds, parallelStepIds, optionalStepIds, estimatedCompletionMinutes };
}
