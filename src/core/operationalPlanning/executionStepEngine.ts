import type { ExecutionPhase, ExecutionStep, DependencyCycleResult } from "@/types/operationalPlanning";

/**
 * v2.0 Checkpoint 27.2, Steps 4-5 — Execution Step Engine. Steps live
 * inline on their phase (see `types/operationalPlanning.ts`'s own
 * module-level doc comment for why); this file only ever reads that
 * structure — it never selects, assigns, or schedules a step, and it
 * never mutates one.
 */

export function flattenSteps(phases: ExecutionPhase[]): ExecutionStep[] {
  return phases.flatMap((p) => p.steps);
}

export function findStepById(phases: ExecutionPhase[], stepId: string): ExecutionStep | null {
  return flattenSteps(phases).find((s) => s.id === stepId) ?? null;
}

/** Every dependency whose `step_id` doesn't resolve to a real step anywhere in this plan — a broken reference, distinct from a cycle (see `detectDependencyCycle`). */
export interface BrokenDependency {
  stepId: string;
  missingStepId: string;
}

export function findBrokenDependencies(phases: ExecutionPhase[]): BrokenDependency[] {
  const steps = flattenSteps(phases);
  const stepIds = new Set(steps.map((s) => s.id));
  const broken: BrokenDependency[] = [];
  for (const step of steps) {
    for (const dep of step.dependencies) {
      if (!stepIds.has(dep.step_id)) broken.push({ stepId: step.id, missingStepId: dep.step_id });
    }
  }
  return broken;
}

/**
 * DFS-based cycle detection over the step dependency graph (a step
 * "depends on" another step: edge `step -> dependency.step_id`) using
 * standard white/gray/black coloring. Dangling references (a
 * `step_id` naming a step that doesn't exist in this plan) are silently
 * skipped here — that's `findBrokenDependencies`'s job, a distinct
 * validation concern from "does a cycle exist among the real steps."
 * Returns the first cycle found, in cycle order; `[]` when none exists.
 */
export function detectDependencyCycle(phases: ExecutionPhase[]): DependencyCycleResult {
  const steps = flattenSteps(phases);
  const stepById = new Map(steps.map((s) => [s.id, s] as const));
  const color = new Map<string, "white" | "gray" | "black">(steps.map((s) => [s.id, "white"] as const));
  const path: string[] = [];

  function visit(stepId: string): string[] | null {
    color.set(stepId, "gray");
    path.push(stepId);
    const step = stepById.get(stepId);
    if (step) {
      for (const dep of step.dependencies) {
        if (!stepById.has(dep.step_id)) continue;
        const depColor = color.get(dep.step_id);
        if (depColor === "gray") {
          const cycleStart = path.indexOf(dep.step_id);
          return [...path.slice(cycleStart), dep.step_id];
        }
        if (depColor === "white") {
          const found = visit(dep.step_id);
          if (found) return found;
        }
      }
    }
    color.set(stepId, "black");
    path.pop();
    return null;
  }

  for (const step of steps) {
    if (color.get(step.id) === "white") {
      const cycle = visit(step.id);
      if (cycle) return { hasCycle: true, cycleStepIds: cycle };
    }
  }
  return { hasCycle: false, cycleStepIds: [] };
}
