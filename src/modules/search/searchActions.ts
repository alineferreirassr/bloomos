"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { generateId, nowIso } from "@/lib/data/utils";

import { readSavedSearches, writeSavedSearches } from "@/lib/data/mock/savedSearchesStore";
import { readSearchHistory, writeSearchHistory } from "@/lib/data/mock/searchHistoryStore";
import { readWorkspaceFavorites } from "@/lib/data/mock/workspaceFavoritesStore";
import { readWorkspaceRecentItems } from "@/lib/data/mock/workspaceRecentItemsStore";

import { runSearch } from "@/core/search/pipeline";
import { applyRankingBoosts, buildResultKey } from "@/core/search/rankingEngine";
import { sortSavedSearchesByRecency, removeSavedSearchById } from "@/core/search/savedSearchesEngine";
import { recordSearchHistoryEntry, sortSearchHistoryByRecency, MAX_SEARCH_HISTORY } from "@/core/search/searchHistoryEngine";
import { computeSearchAnalytics } from "@/core/search/searchAnalyticsEngine";
import { computeSearchHealth } from "@/core/search/searchHealthEngine";
import { searchHealthToRecommendations } from "@/core/search/executiveIntegration";
import { canAccessRoute } from "@/core/permissions/routeAccess";
import { getCommandUsage } from "@/core/commandPalette/commandUsageStore";
import { getSearchableEntities } from "@/core/search/registry";

import type { SearchResult, SearchResultFilters } from "@/core/search/types";
import type { EntityType } from "@/core/enums/entityType";
import type { SavedSearch, SearchHistoryEntry } from "@/types/globalSearch";
import type { SearchAnalyticsSummary } from "@/types/searchAnalytics";
import type { SearchHealthReport } from "@/types/searchHealth";
import type { Permission } from "@/core/enums/permission";
import type { OperationalRecommendation } from "@/types/businessHealth";

const GENERIC_ACCESS_ERROR = "You don't have access to search this Workspace.";

export type SearchActionResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * The one entry point the Global Search UI / Universal Command Center
 * should call — never `runSearch()` directly from a client component.
 * Composes, in order: `runSearch()` (provider + ranking + filters, unchanged),
 * a permission filter ("Hidden entities must never appear in search" — the
 * spec's own words, enforced here via the exact same `canAccessRoute()`
 * every route-guard in this app already uses, never a second permission
 * check), a recency/favorite boost (`rankingEngine.ts`), then records the
 * query in this member's own Search History for Search Analytics.
 */
export async function searchAction(term: string, entityTypes?: EntityType[], filters?: SearchResultFilters): Promise<SearchActionResult<SearchResult[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const workspaceId = session.workspace.id;
  const memberId = session.membership.id;
  const can = (permission: Permission) => session.permissions.includes(permission);

  const rawResults = await runSearch({ workspaceId, term, entityTypes, filters });
  const visibleResults = rawResults.filter((result) => canAccessRoute(result.route, can));

  const allFavorites = readWorkspaceFavorites().filter((f) => f.workspace_id === workspaceId && f.member_id === memberId);
  const allRecent = readWorkspaceRecentItems().filter((r) => r.workspace_id === workspaceId && r.member_id === memberId);
  const recentKeys = new Set(allRecent.map((r) => buildResultKey(r.entity_type, r.entity_id)));
  const favoriteKeys = new Set(allFavorites.map((f) => buildResultKey(f.entity_type, f.entity_id)));
  const boosted = applyRankingBoosts(visibleResults, { recentKeys, favoriteKeys });
  const ranked = [...boosted].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (term.trim() !== "") {
    const allHistory = readSearchHistory();
    const mine = allHistory.filter((h) => h.workspace_id === workspaceId && h.member_id === memberId);
    const others = allHistory.filter((h) => !(h.workspace_id === workspaceId && h.member_id === memberId));
    const entry: SearchHistoryEntry = { id: generateId("searchhist"), workspace_id: workspaceId, member_id: memberId, term, entityTypes: entityTypes ?? null, resultCount: ranked.length, searched_at: nowIso() };
    writeSearchHistory([...others, ...recordSearchHistoryEntry(mine, entry)]);
  }

  return { success: true, data: ranked };
}

export interface SearchableEntitySummary {
  entityType: EntityType;
  label: string;
  module: string;
}

/**
 * Entity-type filter chips need a human label + module grouping for every
 * searchable type, without hardcoding a second label map next to the one
 * `core/search/registry.ts` already owns. `route` is dropped — a function
 * value can't cross the Server Action boundary — the UI never needs it,
 * since every `SearchResult` already carries its own resolved `route`.
 */
export async function listSearchableEntityTypesAction(): Promise<SearchActionResult<SearchableEntitySummary[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  return { success: true, data: getSearchableEntities().map(({ entityType, label, module }) => ({ entityType, label, module })) };
}

export async function listSavedSearchesAction(): Promise<SearchActionResult<SavedSearch[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const mine = readSavedSearches().filter((s) => s.workspace_id === session.workspace.id && s.member_id === session.membership.id);
  return { success: true, data: sortSavedSearchesByRecency(mine) };
}

export async function createSavedSearchAction(label: string, term: string, filters: SearchResultFilters | null): Promise<SearchActionResult<SavedSearch[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const workspaceId = session.workspace.id;
  const memberId = session.membership.id;
  const all = readSavedSearches();
  const mine = all.filter((s) => s.workspace_id === workspaceId && s.member_id === memberId);
  const others = all.filter((s) => !(s.workspace_id === workspaceId && s.member_id === memberId));

  const saved: SavedSearch = { id: generateId("savedsearch"), workspace_id: workspaceId, member_id: memberId, label, term, filters, created_at: nowIso() };
  const nextMine = [...mine, saved];

  writeSavedSearches([...others, ...nextMine]);
  return { success: true, data: sortSavedSearchesByRecency(nextMine) };
}

export async function deleteSavedSearchAction(savedSearchId: string): Promise<SearchActionResult<SavedSearch[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const workspaceId = session.workspace.id;
  const memberId = session.membership.id;
  const all = readSavedSearches();
  const mine = removeSavedSearchById(
    all.filter((s) => s.workspace_id === workspaceId && s.member_id === memberId),
    savedSearchId,
  );
  const others = all.filter((s) => !(s.workspace_id === workspaceId && s.member_id === memberId));

  writeSavedSearches([...others, ...mine]);
  return { success: true, data: sortSavedSearchesByRecency(mine) };
}

export async function getSearchHistoryAction(): Promise<SearchActionResult<SearchHistoryEntry[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const mine = readSearchHistory().filter((h) => h.workspace_id === session.workspace.id && h.member_id === session.membership.id);
  return { success: true, data: sortSearchHistoryByRecency(mine).slice(0, MAX_SEARCH_HISTORY) };
}

export async function clearSearchHistoryAction(): Promise<SearchActionResult<SearchHistoryEntry[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const all = readSearchHistory();
  const others = all.filter((h) => !(h.workspace_id === session.workspace.id && h.member_id === session.membership.id));
  writeSearchHistory(others);
  return { success: true, data: [] };
}

/** `workspace.manage` — same elevated gate every workspace-wide analytics/health surface in this codebase already requires (e.g. `workspaceActions.ts`'s own layout mutations). */
export async function getSearchAnalyticsAction(): Promise<SearchActionResult<SearchAnalyticsSummary>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const workspaceId = session.workspace.id;
  const history = readSearchHistory().filter((h) => h.workspace_id === workspaceId);
  const recentItems = readWorkspaceRecentItems().filter((r) => r.workspace_id === workspaceId);
  const favorites = readWorkspaceFavorites().filter((f) => f.workspace_id === workspaceId);

  return { success: true, data: computeSearchAnalytics(history, recentItems, favorites, getCommandUsage(), nowIso()) };
}

export async function getSearchHealthAction(): Promise<SearchActionResult<SearchHealthReport>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  return { success: true, data: computeSearchHealth(nowIso()) };
}

/**
 * v2.0 Checkpoint 40 — the `xRecommendationsForExecutiveDecisions()`
 * per-platform naming convention every other platform in this codebase
 * already follows (see `workflowRecommendationsForExecutiveDecisions`,
 * `routeOptimizationRecommendationsForExecutiveDecisions`, etc.), returning
 * the bare `OperationalRecommendation[]` those callers wrap themselves —
 * `executiveDecisionsActions.ts`'s own `Promise.all` + `recommendationSources`
 * array wraps this one in `{ generatedBy: "search_health_engine", ... }`,
 * exactly like every sibling source. Self-contained: returns `[]` for an
 * inactive session, never throws.
 */
export async function searchRecommendationsForExecutiveDecisions(): Promise<OperationalRecommendation[]> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];

  const report = computeSearchHealth(nowIso());
  return searchHealthToRecommendations(report, session.workspace.id);
}
