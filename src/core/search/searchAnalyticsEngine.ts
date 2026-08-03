import type { SearchHistoryEntry } from "@/types/globalSearch";
import type { SearchAnalyticsSummary } from "@/types/searchAnalytics";
import type { WorkspaceFavorite, WorkspaceRecentItem } from "@/types/smartWorkspace";
import type { CommandUsageEntry } from "@/core/commandPalette/commandUsageStore";
import { noResultSearchHistory } from "@/core/search/searchHistoryEngine";

/**
 * v2.0 Checkpoint 40 — pure computation over already-fetched history/
 * recent-item/favorite/command-usage lists — no new tracking store, no I/O.
 * Every metric here is either a direct count over `SearchHistoryEntry[]`
 * (the one real record of what a member actually typed and how many
 * results it returned) or a reuse of an already-real Workspace list
 * (`WorkspaceRecentItem`'s own `visit_count`, `WorkspaceFavorite`'s own
 * `pinned`). "Average search time" is deliberately NOT included —
 * `SearchHistoryEntry` never recorded a duration (nothing in `runSearch()`
 * timed itself before this checkpoint), and fabricating one would violate
 * this codebase's own "never invent a value the data doesn't honestly
 * support" discipline; a future checkpoint that wants it should add a
 * `durationMs` field to `SearchHistoryEntry` first, the same way `visit_count`
 * was added here.
 */
export function computeSearchAnalytics(
  history: SearchHistoryEntry[],
  recentItems: WorkspaceRecentItem[],
  favorites: WorkspaceFavorite[],
  commandUsage: CommandUsageEntry[],
  evaluatedAt: string,
): SearchAnalyticsSummary {
  const totalSearches = history.length;

  const termCounts = new Map<string, number>();
  const entityTypeCounts = new Map<string, number>();
  for (const entry of history) {
    const normalizedTerm = entry.term.trim().toLowerCase();
    if (normalizedTerm) termCounts.set(normalizedTerm, (termCounts.get(normalizedTerm) ?? 0) + 1);
    for (const entityType of entry.entityTypes ?? []) {
      entityTypeCounts.set(entityType, (entityTypeCounts.get(entityType) ?? 0) + 1);
    }
  }

  const mostSearchedTerms = [...termCounts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const mostSearchedEntityTypes = [...entityTypeCounts.entries()]
    .map(([entityType, count]) => ({ entityType: entityType as SearchAnalyticsSummary["mostSearchedEntityTypes"][number]["entityType"], count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const noResults = noResultSearchHistory(history);
  const noResultSearches = noResults.map((entry) => ({ term: entry.term, searched_at: entry.searched_at }));

  const totalResultCount = history.reduce((sum, entry) => sum + entry.resultCount, 0);
  const averageResultCount = totalSearches > 0 ? totalResultCount / totalSearches : 0;
  const successRate = totalSearches > 0 ? (totalSearches - noResults.length) / totalSearches : 0;

  const mostVisited = [...recentItems].sort((a, b) => b.visit_count - a.visit_count)[0] ?? null;
  const mostOpenedResult = mostVisited
    ? { entity_type: mostVisited.entity_type, entity_id: mostVisited.entity_id, label: mostVisited.label, visit_count: mostVisited.visit_count }
    : null;

  const firstPinned = favorites.find((f) => f.pinned) ?? null;
  const mostPinnedResult = firstPinned ? { entity_type: firstPinned.entity_type, entity_id: firstPinned.entity_id, label: firstPinned.label } : null;

  return {
    totalSearches,
    mostSearchedTerms,
    mostSearchedEntityTypes,
    mostSearchedCommands: commandUsage.slice(0, 10),
    noResultSearches,
    noResultRate: totalSearches > 0 ? noResults.length / totalSearches : 0,
    averageResultCount,
    successRate,
    mostOpenedResult,
    mostPinnedResult,
    evaluatedAt,
  };
}
