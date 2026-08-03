import type { SearchResult } from "@/core/search/types";

/**
 * v2.0 Checkpoint 40 — recency and favorite boosting layered on top of
 * `rankSearchResults()` (`pipeline.ts`), never inside it. A `SearchProvider`
 * only ever sees `SearchQuery` (workspace + term + filters) — it has no
 * business reading one member's own Favorites/Recent Items, that data lives
 * in `modules/workspace`'s own tables. Keeping the boost a separate, pure
 * post-processing pass means `core/search` stays fully decoupled from
 * per-member Workspace state, the same "provider execution and ranking are
 * two separate concerns on purpose" reasoning `pipeline.ts`'s own doc
 * comment already states for the plain score-sort pass.
 */

export const RECENCY_BOOST = 15;
export const FAVORITE_BOOST = 25;

function resultKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export interface RankingBoostContext {
  /** `{entityType}:{entityId}` keys already viewed recently — see `resultKey`. */
  recentKeys?: ReadonlySet<string>;
  /** `{entityType}:{entityId}` keys the member has favorited. */
  favoriteKeys?: ReadonlySet<string>;
}

export function buildResultKey(entityType: string, entityId: string): string {
  return resultKey(entityType, entityId);
}

/**
 * Returns a new array — never mutates `results` — with `score` raised for
 * any result whose key appears in `recentKeys`/`favoriteKeys`. A result with
 * no `score` at all (a provider that never scored it) is treated as `0`
 * before boosting, so an unscored-but-favorited result still outranks an
 * unscored-and-unfavorited one without silently becoming a false "exact
 * match."
 */
export function applyRankingBoosts(results: SearchResult[], context: RankingBoostContext): SearchResult[] {
  const { recentKeys, favoriteKeys } = context;
  if (!recentKeys?.size && !favoriteKeys?.size) return results;

  return results.map((result) => {
    const key = resultKey(result.entityType, result.entityId);
    let boost = 0;
    if (recentKeys?.has(key)) boost += RECENCY_BOOST;
    if (favoriteKeys?.has(key)) boost += FAVORITE_BOOST;
    if (boost === 0) return result;

    return { ...result, score: (result.score ?? 0) + boost };
  });
}
