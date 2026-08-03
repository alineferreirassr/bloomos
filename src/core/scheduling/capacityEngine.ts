import type { CapacityRule, CapacityScope } from "@/types/scheduling";

/**
 * v2.0 Checkpoint 27, Step 10 — Capacity Engine. Deliberately generic
 * over what's being counted — a `CapacityUsageEntry` is a caller-mapped
 * view of whatever Reservations/Appointments apply to a given scope, so
 * this engine never needs to know `Reservation`'s or `Appointment`'s
 * exact shape (or duplicate `assignmentConflictEngine.ts`'s team-size
 * capacity check, which is about WHO can be assigned, not WHEN).
 */

export interface CapacityUsageEntry {
  scope: CapacityScope;
  scope_id: string | null;
  starts_at: string;
  ends_at: string;
}

export function resolveApplicableCapacityRule(rules: CapacityRule[], scope: CapacityScope, scopeId: string | null): CapacityRule | null {
  return rules.find((r) => r.scope === scope && r.scope_id === scopeId) ?? null;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * `"time_window"` counts true concurrency — usage entries whose interval
 * overlaps the candidate's. `"day"` counts every usage entry that falls
 * on the same calendar date as the candidate's start (a coarser,
 * whole-day cap, e.g. "at most 3 installations scheduled per day" —
 * matches on the raw UTC date since `CapacityRule` carries no
 * `time_zone` of its own).
 */
export function countConcurrentUsage(rule: CapacityRule, candidateInterval: { starts_at: string; ends_at: string }, existingUsage: CapacityUsageEntry[]): number {
  const matching = existingUsage.filter((entry) => entry.scope === rule.scope && entry.scope_id === rule.scope_id);
  if (rule.window === "time_window") {
    return matching.filter((entry) => overlaps(entry.starts_at, entry.ends_at, candidateInterval.starts_at, candidateInterval.ends_at)).length;
  }
  const candidateDate = candidateInterval.starts_at.slice(0, 10);
  return matching.filter((entry) => entry.starts_at.slice(0, 10) === candidateDate).length;
}

export interface CapacityCheckResult {
  withinCapacity: boolean;
  currentUsage: number;
  /** `null` when no `CapacityRule` is configured for this scope — an unconfigured scope is never artificially capped, the same "not applicable resolves to a vacuous pass" discipline `capabilityScoreEngine.ts` established. */
  maxConcurrent: number | null;
}

/** Checks whether adding `candidateInterval` as one more usage entry would still respect `rule.max_concurrent`. Pass `rule: null` when no rule is configured for the scope. */
export function checkCapacity(rule: CapacityRule | null, candidateInterval: { starts_at: string; ends_at: string }, existingUsage: CapacityUsageEntry[]): CapacityCheckResult {
  if (rule === null) return { withinCapacity: true, currentUsage: 0, maxConcurrent: null };
  const currentUsage = countConcurrentUsage(rule, candidateInterval, existingUsage);
  return { withinCapacity: currentUsage < rule.max_concurrent, currentUsage, maxConcurrent: rule.max_concurrent };
}
