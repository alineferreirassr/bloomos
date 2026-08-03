import type { ExecutionPhase, ExecutionPhaseKind } from "@/types/operationalPlanning";

/**
 * v2.0 Checkpoint 27.2, Step 3 — Phase Engine. A plan's `order` field is
 * always author-assigned (set explicitly on each `ExecutionPhase`) — this
 * engine never recomputes it. `DEFAULT_PHASE_ORDER` exists only as a
 * *validation hint*: the spec's own named phases (Preparation → Travel →
 * Arrival → Setup → Execution → Quality Review → Cleanup → Completion)
 * describe a natural real-world sequence, and `validatePhaseOrder` flags
 * when a plan's actual ordering contradicts it — a warning, never a hard
 * block, since a legitimate plan can skip or reorder phases.
 */

const DEFAULT_PHASE_ORDER: Record<ExecutionPhaseKind, number> = {
  preparation: 0,
  travel: 1,
  arrival: 2,
  setup: 3,
  execution: 4,
  quality_review: 5,
  cleanup: 6,
  completion: 7,
  custom: -1,
};

/** Sorted by each phase's own explicit `order` field — never re-derived from `kind`. */
export function resolvePhaseOrder(phases: ExecutionPhase[]): ExecutionPhase[] {
  return [...phases].sort((a, b) => a.order - b.order);
}

export interface PhaseOrderIssue {
  phaseId: string;
  detail: string;
}

/** `"custom"` phases are exempt — they carry no natural position and never trigger this check. */
export function validatePhaseOrder(phases: ExecutionPhase[]): PhaseOrderIssue[] {
  const ordered = resolvePhaseOrder(phases);
  const issues: PhaseOrderIssue[] = [];
  let highestSeenDefault = -1;
  for (const phase of ordered) {
    if (phase.kind === "custom") continue;
    const defaultIndex = DEFAULT_PHASE_ORDER[phase.kind];
    if (defaultIndex < highestSeenDefault) {
      issues.push({ phaseId: phase.id, detail: `"${phase.name}" (${phase.kind}) is ordered after a phase that naturally comes later.` });
    } else {
      highestSeenDefault = defaultIndex;
    }
  }
  return issues;
}
