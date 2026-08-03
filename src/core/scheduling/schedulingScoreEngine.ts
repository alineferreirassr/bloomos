import type { SchedulingScores, ConflictSeverity, SchedulingConflict } from "@/types/scheduling";

/**
 * v2.0 Checkpoint 27, Step 13 — Scheduling Score Engine. Schedule
 * QUALITY only — no worker ever factors into any of these six scores,
 * per the stop condition. Every score is a disclosed arithmetic formula
 * over already-computed inputs (appointment/conflict/capacity counts),
 * same "not applicable resolves to a vacuous 100, never a fabricated 0"
 * discipline `capabilityScoreEngine.ts` established for Checkpoint 26.1.
 */

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Share of appointments free of a window-placement issue (`holiday_conflict`/`blackout_conflict`/`timezone_conflict`). */
export function computeWindowQualityScore(appointmentCount: number, windowIssueCount: number): number {
  if (appointmentCount === 0) return 100;
  return clampScore(100 * (1 - windowIssueCount / appointmentCount));
}

/** Share of appointments free of a `buffer_conflict`. */
export function computeBufferQualityScore(appointmentCount: number, bufferConflictCount: number): number {
  if (appointmentCount === 0) return 100;
  return clampScore(100 * (1 - bufferConflictCount / appointmentCount));
}

/** Share of relevant `CapacityRule` checks that stayed within their `max_concurrent`. */
export function computeCapacityUtilizationScore(capacityChecks: Array<{ withinCapacity: boolean }>): number {
  if (capacityChecks.length === 0) return 100;
  const withinCount = capacityChecks.filter((check) => check.withinCapacity).length;
  return clampScore(100 * (withinCount / capacityChecks.length));
}

/** A flat penalty per conflict, weighted by severity — never a percentage of appointments, since even one `"high"` conflict on an otherwise-clean calendar is a real problem worth reflecting immediately. */
const CONFLICT_SEVERITY_PENALTY: Record<ConflictSeverity, number> = { high: 15, medium: 5, low: 2 };

export function computeConflictSeverityScore(conflicts: Array<Pick<SchedulingConflict, "severity">>): number {
  const penalty = conflicts.reduce((sum, conflict) => sum + CONFLICT_SEVERITY_PENALTY[conflict.severity], 0);
  return clampScore(100 - penalty);
}

/** How full the calendar is relative to its own configured working-hours capacity — a descriptive measure, not inherently "good" or "bad" at any particular value. `0` when there's no configured working-hours time to book against at all. */
export function computeScheduleDensityScore(bookedMinutes: number, availableMinutes: number): number {
  if (availableMinutes <= 0) return 0;
  return clampScore(100 * (bookedMinutes / availableMinutes));
}

/** Unweighted average of the other five — same "simple, disclosed composite" precedent every other top-level score in this app uses (e.g. `ObjectiveHealthEngine`). */
export function computeCalendarHealthScore(scores: Omit<SchedulingScores, "calendarHealthScore">): number {
  const values = Object.values(scores);
  return clampScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export interface SchedulingScoreInput {
  appointmentCount: number;
  windowIssueCount: number;
  bufferConflictCount: number;
  capacityChecks: Array<{ withinCapacity: boolean }>;
  conflicts: Array<Pick<SchedulingConflict, "severity">>;
  bookedMinutes: number;
  availableMinutes: number;
}

export function computeSchedulingScores(input: SchedulingScoreInput): SchedulingScores {
  const windowQualityScore = computeWindowQualityScore(input.appointmentCount, input.windowIssueCount);
  const bufferQualityScore = computeBufferQualityScore(input.appointmentCount, input.bufferConflictCount);
  const capacityUtilizationScore = computeCapacityUtilizationScore(input.capacityChecks);
  const conflictSeverityScore = computeConflictSeverityScore(input.conflicts);
  const scheduleDensityScore = computeScheduleDensityScore(input.bookedMinutes, input.availableMinutes);
  const calendarHealthScore = computeCalendarHealthScore({ windowQualityScore, bufferQualityScore, capacityUtilizationScore, conflictSeverityScore, scheduleDensityScore });
  return { windowQualityScore, bufferQualityScore, capacityUtilizationScore, conflictSeverityScore, scheduleDensityScore, calendarHealthScore };
}
