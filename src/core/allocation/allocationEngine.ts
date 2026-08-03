import type { AllocationRequirementLine, AllocationCandidate, AllocationStrategy, ResourceType, FallbackChain } from "@/types/allocation";
import { buildFallbackChain, type ResourceRef } from "@/core/allocation/fallbackEngine";

/**
 * v2.0 Checkpoint 27.1, Step 4 — Allocation Engine. Never dispatches,
 * never reserves, never schedules — it only proposes which resources
 * should fill each requirement line. Deliberately never re-evaluates
 * eligibility, availability, or scheduling itself: every `CandidatePoolEntry`
 * arrives pre-resolved by the caller (`allocationActions.ts`), which
 * builds it from Checkpoint 26.1's `EligibilityEngine`/`CapabilityScoreEngine`
 * for workers and simple status checks for other resource types. This
 * file's only job is *selecting among an already-known-eligible pool*
 * per Step 6's strategy — the same "translate, don't duplicate"
 * discipline every prior checkpoint's integration engines established.
 */

export interface CandidatePoolEntry {
  resource_type: ResourceType;
  resource_id: string;
  eligible: boolean;
  /** Populated only when `eligible: false` — never a bare boolean with no reason. */
  ineligibleReason: string | null;
  /** 0-100, already computed by the caller (e.g. Checkpoint 26.1's `overallCapabilityScore` for workers). */
  score: number;
  /** How many other active allocations/assignments this resource currently carries — the raw material `least_busy`/`balanced_workload` sort on. */
  currentWorkload: number;
  /** Caller-supplied flag for the `"custom"` strategy — this engine assigns it no meaning of its own beyond "sorts first." */
  isPreferred: boolean;
}

const WORKLOAD_PENALTY_PER_ASSIGNMENT = 5;

/** Every strategy is a total order over the pool — ties always break on `resource_id` so results stay reproducible, never arbitrary. */
function rankCandidatesByStrategy(pool: CandidatePoolEntry[], strategy: AllocationStrategy, preferredResourceIds: string[]): CandidatePoolEntry[] {
  const sorted = [...pool];
  switch (strategy) {
    case "highest_capability":
      return sorted.sort((a, b) => b.score - a.score || a.resource_id.localeCompare(b.resource_id));
    case "lowest_cost":
      // No cost/rate field exists anywhere in the Workforce/Equipment/Vehicle/Vendor domain (disclosed limitation, same "correctly inert rather than fabricated" precedent `equipment-capabilities.md` established) — falls back to score as a stable secondary key so results stay deterministic, never a fabricated cost figure.
      return sorted.sort((a, b) => b.score - a.score || a.resource_id.localeCompare(b.resource_id));
    case "least_busy":
      return sorted.sort((a, b) => a.currentWorkload - b.currentWorkload || b.score - a.score || a.resource_id.localeCompare(b.resource_id));
    case "balanced_workload":
      return sorted.sort((a, b) => {
        const blendedA = a.score - a.currentWorkload * WORKLOAD_PENALTY_PER_ASSIGNMENT;
        const blendedB = b.score - b.currentWorkload * WORKLOAD_PENALTY_PER_ASSIGNMENT;
        return blendedB - blendedA || a.resource_id.localeCompare(b.resource_id);
      });
    case "preferred_team":
    case "preferred_worker":
      return sorted.sort((a, b) => {
        const aPreferred = preferredResourceIds.includes(a.resource_id) ? 1 : 0;
        const bPreferred = preferredResourceIds.includes(b.resource_id) ? 1 : 0;
        return bPreferred - aPreferred || b.score - a.score || a.resource_id.localeCompare(b.resource_id);
      });
    case "custom":
      return sorted.sort((a, b) => {
        if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
        return b.score - a.score || a.resource_id.localeCompare(b.resource_id);
      });
  }
}

export interface AllocationEngineInput {
  requirementLines: AllocationRequirementLine[];
  /** Indexed identically to `requirementLines` — `candidatePoolsByLineIndex[i]` is the pool for `requirementLines[i]`. */
  candidatePoolsByLineIndex: CandidatePoolEntry[][];
  strategy: AllocationStrategy;
  maxBackupsPerLine?: number;
}

export interface AllocationProposal {
  candidates: AllocationCandidate[];
  /** Only built for single-quantity lines (`quantity: 1`) — the common case a primary/backup chain models cleanly. A multi-quantity line's extra eligible candidates are still recorded as unselected `AllocationCandidate`s with a real rejection reason, just without a formal chain. */
  fallbackChains: FallbackChain[];
}

export function buildAllocationProposal(input: AllocationEngineInput): AllocationProposal {
  const candidates: AllocationCandidate[] = [];
  const fallbackChains: FallbackChain[] = [];

  input.requirementLines.forEach((line, lineIndex) => {
    const pool = input.candidatePoolsByLineIndex[lineIndex] ?? [];
    const ineligible = pool.filter((entry) => !entry.eligible);
    const ranked = rankCandidatesByStrategy(
      pool.filter((entry) => entry.eligible),
      input.strategy,
      line.preferred_resource_ids,
    );

    const selectedCount = Math.min(line.quantity, ranked.length);
    ranked.forEach((entry, rank) => {
      const selected = rank < selectedCount;
      candidates.push({
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        requirement_line_index: lineIndex,
        selected,
        rejection_reason: selected ? null : `Not selected — ${selectedCount} of ${line.quantity} needed already filled by a higher-ranked candidate.`,
        is_fallback: false,
        fallback_tier: null,
      });
    });
    for (const entry of ineligible) {
      candidates.push({ resource_type: entry.resource_type, resource_id: entry.resource_id, requirement_line_index: lineIndex, selected: false, rejection_reason: entry.ineligibleReason ?? "Not eligible.", is_fallback: false, fallback_tier: null });
    }

    if (line.quantity === 1 && ranked.length > 0) {
      const primary: ResourceRef = { resource_type: ranked[0].resource_type, resource_id: ranked[0].resource_id };
      const backups: ResourceRef[] = ranked.slice(1).map((entry) => ({ resource_type: entry.resource_type, resource_id: entry.resource_id }));
      fallbackChains.push(buildFallbackChain(lineIndex, primary, backups, input.maxBackupsPerLine));
    }
  });

  return { candidates, fallbackChains };
}
