import type { WorkspaceRecentItem } from "@/types/smartWorkspace";

/** v2.0 Checkpoint 38, Step 7 — pure recent-items list management: de-dupe by entity, cap length, most-recent-first. */

export const MAX_RECENT_ITEMS = 20;

/**
 * Records a view: if the entity is already in the list, it's moved to the
 * front with a fresh `viewed_at` and its `visit_count` incremented (the
 * existing `id` is kept, not duplicated); otherwise a new entry is
 * unshifted at `visit_count: 1`. The list is capped at `MAX_RECENT_ITEMS`,
 * oldest dropped first.
 */
export function recordRecentItem(existing: WorkspaceRecentItem[], entry: WorkspaceRecentItem): WorkspaceRecentItem[] {
  const priorMatch = existing.find((item) => item.entity_type === entry.entity_type && item.entity_id === entry.entity_id);
  const withoutDuplicate = existing.filter((item) => !(item.entity_type === entry.entity_type && item.entity_id === entry.entity_id));
  const recorded: WorkspaceRecentItem = { ...entry, visit_count: (priorMatch?.visit_count ?? 0) + 1 };
  const next = [recorded, ...withoutDuplicate];
  return next.slice(0, MAX_RECENT_ITEMS);
}

export function sortRecentItemsByRecency(items: WorkspaceRecentItem[]): WorkspaceRecentItem[] {
  return [...items].sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime());
}

/** v2.0 Checkpoint 40 — "Most Visited," a sort over this same list by `visit_count`, never a second tracking store. */
export function sortRecentItemsByVisitCount(items: WorkspaceRecentItem[]): WorkspaceRecentItem[] {
  return [...items].sort((a, b) => b.visit_count - a.visit_count);
}

/** v2.0 Checkpoint 40 — "Recently Edited," a filter over this same list by `action === "edit"`, never a second tracking store. */
export function recentlyEditedItems(items: WorkspaceRecentItem[]): WorkspaceRecentItem[] {
  return sortRecentItemsByRecency(items.filter((item) => item.action === "edit"));
}
