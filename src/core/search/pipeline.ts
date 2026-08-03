import type { SearchQuery, SearchResult } from "@/core/search/types";
import { getActiveSearchProvider } from "@/core/search/service";
import { applySearchResultFilters } from "@/core/search/filterEngine";

/**
 * Sorts by `score` descending (an unscored result sorts last, not first —
 * a provider that never sets `score` degrades to stable input order rather
 * than a misleading "everything ties for first"), then applies `query.limit`.
 * Kept as its own function (not inlined into `runSearch`) so a future
 * ranking strategy — recency boost, entity-type weighting — replaces this
 * one function without touching how a caller invokes search.
 */
export function rankSearchResults(results: SearchResult[], query: SearchQuery): SearchResult[] {
  const ranked = [...results].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return query.limit !== undefined ? ranked.slice(0, query.limit) : ranked;
}

/**
 * The one entry point Command Palette (and any future search surface)
 * should call — provider execution and ranking are two separate concerns
 * on purpose (a provider may already return results in relevance order,
 * but every caller still gets the same, single, documented ranking pass
 * applied on top), matching this codebase's "read from one deterministic
 * place" precedent everywhere else (e.g. `computeEventFinancialSummary`).
 *
 * v2.0 Checkpoint 40 — `query.filters` (facet filtering) is applied BEFORE
 * the ranking pass's own `limit` slice, never after: filtering after a
 * limit-truncated list could silently return fewer results than actually
 * matched (a filtered-out result taking a slot a real match should have
 * had). Filtering doesn't touch score/order itself, so applying it first
 * changes nothing about relevance, only which candidates are eligible to be
 * ranked at all. Recency/favorite boosting is deliberately NOT applied here
 * — see `rankingEngine.ts`'s own doc comment for why that stays a
 * caller-side pass instead.
 */
export async function runSearch(query: SearchQuery): Promise<SearchResult[]> {
  const rawResults = await getActiveSearchProvider().search(query);
  const filtered = applySearchResultFilters(rawResults, query.filters);
  return rankSearchResults(filtered, query);
}
