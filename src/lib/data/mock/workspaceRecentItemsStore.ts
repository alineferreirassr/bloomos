import type { WorkspaceRecentItem } from "@/types/smartWorkspace";

/**
 * v2.0 Checkpoint 38, Step 2 — one row per (workspace, member, entity)
 * view, most-recent-first. Capping and de-duplication happen in
 * `core/workspace/recentItemsEngine.ts` (pure list transform) before a
 * write ever reaches this store — this file only holds whatever list it's
 * handed.
 */
let workspaceRecentItems: WorkspaceRecentItem[] = [];

export function readWorkspaceRecentItems(): WorkspaceRecentItem[] {
  return workspaceRecentItems;
}

export function writeWorkspaceRecentItems(next: WorkspaceRecentItem[]): void {
  workspaceRecentItems = next;
}

/** Test-only: restore the store to its empty state between test cases. */
export function resetWorkspaceRecentItemsStore(): void {
  workspaceRecentItems = [];
}
