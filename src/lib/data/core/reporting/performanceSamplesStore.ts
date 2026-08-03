import { nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 42, Step 9 — a small ring buffer of real, measured
 * `computeReport()` durations per workspace, feeding the Reporting Health
 * Engine's `performance` category. Never a fabricated benchmark — every
 * sample here is a duration `reportingActions.ts` actually measured around
 * a real computation.
 */
const MAX_SAMPLES_PER_WORKSPACE = 20;

interface PerformanceSample {
  workspace_id: string;
  duration_ms: number;
  recorded_at: string;
}

let samples: PerformanceSample[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetReportPerformanceSamples(): void {
  samples = [];
}

export function recordReportComputationDuration(workspaceId: string, durationMs: number): void {
  const mine = samples.filter((s) => s.workspace_id === workspaceId);
  const others = samples.filter((s) => s.workspace_id !== workspaceId);
  const nextMine = [...mine, { workspace_id: workspaceId, duration_ms: durationMs, recorded_at: nowIso() }].slice(-MAX_SAMPLES_PER_WORKSPACE);
  samples = [...others, ...nextMine];
}

export function getRecentReportComputationDurations(workspaceId: string): number[] {
  return samples.filter((s) => s.workspace_id === workspaceId).map((s) => s.duration_ms);
}
