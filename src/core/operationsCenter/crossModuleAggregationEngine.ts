import type { OperationalSource, SourceOutcome } from "@/types/operationsCenter";
import { nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 31, Step 3 — Cross-Module Aggregation Engine. Reusable,
 * source-agnostic orchestration over whatever `SourceFetcher`s the caller
 * hands in — this file never imports a single module's own action or
 * store directly, so it can never "reach directly into internal stores."
 * Every real fetcher (built in `operationalSnapshotEngine.ts`/
 * `operationsCenterActions.ts`) wraps a genuine public module action
 * (`listDispatchOrdersAction`, `evaluateWorkspaceSchedulingAction`, etc.)
 * — this engine only orchestrates the calling and caching, never invents
 * what to call.
 *
 * "One failing source must not blank the entire Operations Center" is
 * satisfied structurally: every fetcher runs independently (via
 * `Promise.all` over per-source try/catch), and a failing/unavailable
 * source falls back to its own last-successful cached value — the same
 * mechanism Step 27's own "Source-Level Caching" requirement asks for,
 * solved once instead of twice.
 */

interface CacheEntry {
  data: unknown;
  fetchedAt: string;
}

let cache = new Map<string, CacheEntry>();

export function resetAggregationCache(): void {
  cache = new Map();
}

export interface SourceFetcher<T> {
  source: OperationalSource;
  fetch: () => Promise<{ success: true; data: T } | { success: false; error: string }>;
}

function cacheKey(workspaceId: string, source: OperationalSource): string {
  return `${workspaceId}:${source}`;
}

/**
 * `successful` — the fetch resolved `{success:true}` just now.
 * `failed` — it resolved `{success:false}` (an anticipated business
 * answer) with no prior cached value to fall back on. `unavailable` —
 * the fetch itself threw/rejected (unexpected) with no cached fallback.
 * `stale` — either failure mode occurred, but a previously successful
 * value is cached and served instead.
 */
async function fetchOneSource<T>(workspaceId: string, fetcher: SourceFetcher<T>): Promise<SourceOutcome<T>> {
  const key = cacheKey(workspaceId, fetcher.source);
  try {
    const result = await fetcher.fetch();
    if (result.success) {
      const fetchedAt = nowIso();
      cache.set(key, { data: result.data, fetchedAt });
      return { source: fetcher.source, state: "successful", data: result.data, error: null, fetchedAt };
    }
    const cached = cache.get(key);
    if (cached) return { source: fetcher.source, state: "stale", data: cached.data as T, error: result.error, fetchedAt: cached.fetchedAt };
    return { source: fetcher.source, state: "failed", data: null, error: result.error, fetchedAt: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    const cached = cache.get(key);
    if (cached) return { source: fetcher.source, state: "stale", data: cached.data as T, error: message, fetchedAt: cached.fetchedAt };
    return { source: fetcher.source, state: "unavailable", data: null, error: message, fetchedAt: null };
  }
}

/** 0-100 — the share of sources reporting `successful`, with `stale` sources counted at half weight since their data is real but old. Vacuous-100 when there are no sources to score at all. */
export function computeSnapshotConfidence(outcomes: SourceOutcome<unknown>[]): number {
  if (outcomes.length === 0) return 100;
  const score = outcomes.reduce((sum, o) => sum + (o.state === "successful" ? 1 : o.state === "stale" ? 0.5 : 0), 0);
  return Math.round((score / outcomes.length) * 100);
}

export interface AggregationResult {
  outcomes: SourceOutcome<unknown>[];
  confidence: number;
}

export async function aggregateFromSources(workspaceId: string, fetchers: SourceFetcher<unknown>[]): Promise<AggregationResult> {
  const outcomes = await Promise.all(fetchers.map((f) => fetchOneSource(workspaceId, f)));
  return { outcomes, confidence: computeSnapshotConfidence(outcomes) };
}

/** Looks up one source's own data out of an already-aggregated outcome list — `null` for `failed`/`unavailable` sources with nothing cached, never a thrown error. */
export function getSourceData<T>(outcomes: SourceOutcome<unknown>[], source: OperationalSource): T | null {
  return (outcomes.find((o) => o.source === source)?.data as T | null) ?? null;
}
