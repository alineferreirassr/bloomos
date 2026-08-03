import type { SearchResult, SearchResultFilters } from "@/core/search/types";

/**
 * v2.0 Checkpoint 40 — applies `SearchResultFilters` to an already-scored,
 * already-ranked `SearchResult[]`. Pure, no I/O, no new business logic —
 * every field it filters on is one `SearchResult` already carries (or
 * doesn't, in which case that filter simply excludes the result rather than
 * guessing). Kept as its own pass, applied after ranking, so a caller can
 * always compute "how many results before filtering" for a search-analytics
 * event without re-running search.
 */
export function applySearchResultFilters(results: SearchResult[], filters?: SearchResultFilters): SearchResult[] {
  if (!filters) return results;

  return results.filter((result) => {
    if (filters.entityTypes && filters.entityTypes.length > 0 && !filters.entityTypes.includes(result.entityType)) return false;
    if (filters.statuses && filters.statuses.length > 0 && (!result.status || !filters.statuses.includes(result.status))) return false;
    if (filters.owners && filters.owners.length > 0 && (!result.owner || !filters.owners.includes(result.owner))) return false;
    if (filters.tags && filters.tags.length > 0 && !filters.tags.some((tag) => result.tags?.includes(tag))) return false;
    if (filters.archived !== undefined && Boolean(result.archived) !== filters.archived) return false;
    if (filters.minHealth !== undefined && (result.health === undefined || result.health < filters.minHealth)) return false;

    if (filters.updatedAfter && (!result.lastUpdatedAt || result.lastUpdatedAt < filters.updatedAfter)) return false;
    if (filters.updatedBefore && (!result.lastUpdatedAt || result.lastUpdatedAt > filters.updatedBefore)) return false;

    return true;
  });
}
