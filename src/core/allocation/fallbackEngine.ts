import type { FallbackChain, ResourceType } from "@/types/allocation";

/**
 * v2.0 Checkpoint 27.1, Step 9 — Fallback Engine. Builds and resolves a
 * primary/backup/second-backup chain for a single requirement line —
 * pure, deterministic; the ordering of `alternatives` (who's backup 1
 * vs. backup 2) is decided entirely by the caller (typically
 * `AllocationEngine`'s own capability-score ranking), never by this file.
 */

const DEFAULT_MAX_BACKUPS = 2;

export interface ResourceRef {
  resource_type: ResourceType;
  resource_id: string;
}

export function buildFallbackChain(requirementLineIndex: number, primary: ResourceRef | null, alternatives: ResourceRef[], maxBackups: number = DEFAULT_MAX_BACKUPS): FallbackChain {
  const backups = alternatives.slice(0, maxBackups).map((alt, index) => ({ ...alt, tier: index + 1 }));
  return { requirement_line_index: requirementLineIndex, primary, backups };
}

export interface ResolvedFallback extends ResourceRef {
  /** `null` when this is the primary resource, not a fallback. */
  tier: number | null;
}

/** Walks the chain in order — primary first, then each backup tier — returning the first resource that isn't in `unavailableResourceIds`. `null` means no resource in the chain is usable, i.e. escalation is needed. */
export function resolveActiveResource(chain: FallbackChain, unavailableResourceIds: ReadonlySet<string>): ResolvedFallback | null {
  if (chain.primary !== null && !unavailableResourceIds.has(chain.primary.resource_id)) return { ...chain.primary, tier: null };
  for (const backup of chain.backups) {
    if (!unavailableResourceIds.has(backup.resource_id)) return backup;
  }
  return null;
}

export function needsEscalation(chain: FallbackChain, unavailableResourceIds: ReadonlySet<string>): boolean {
  return resolveActiveResource(chain, unavailableResourceIds) === null;
}

/** `true` only when the resolved resource is a genuine backup (`tier !== null`) — used to decide whether to record the `allocation_fallback_used` Timeline event. */
export function isFallbackInUse(resolved: ResolvedFallback | null): boolean {
  return resolved !== null && resolved.tier !== null;
}
