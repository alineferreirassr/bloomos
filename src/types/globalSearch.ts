import type { EntityType } from "@/core/enums/entityType";
import type { SearchResultFilters } from "@/core/search/types";

/**
 * v2.0 Checkpoint 40 — Global Search & Universal Command Center. Two
 * genuinely new persisted concepts this checkpoint's own audit confirmed
 * exist nowhere in BloomOS yet: a saved search (a named, reusable term +
 * filter combination) and a search history entry (one raw query a member
 * actually typed). Both are deliberately distinct from
 * `WorkspaceRecentItem` (Checkpoint 38) — that tracks *entities opened*,
 * these track *searches run* — never merged into one store, since a search
 * that returns zero results is still worth recording for Search Analytics
 * (see `core/search/searchAnalyticsEngine.ts`) even though it opened
 * nothing.
 */

export interface SavedSearch {
  id: string;
  workspace_id: string;
  member_id: string;
  label: string;
  term: string;
  filters: SearchResultFilters | null;
  created_at: string;
}

export interface SearchHistoryEntry {
  id: string;
  workspace_id: string;
  member_id: string;
  term: string;
  entityTypes: EntityType[] | null;
  resultCount: number;
  searched_at: string;
}
