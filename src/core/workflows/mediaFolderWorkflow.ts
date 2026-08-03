import type { MediaFolder } from "@/types/mediaFolder";

/**
 * v2.0 Checkpoint 25, Step 3 — Media Folder tree logic. A direct sibling of
 * `documentFolderWorkflow.ts`, adapted for `MediaFolder` — same cycle/move
 * rules, not a reimplementation from scratch.
 */

/**
 * True when setting `folderId`'s parent to `targetParentId` would make
 * `folderId` its own ancestor — either directly (`targetParentId ===
 * folderId`) or transitively (walking up `targetParentId`'s parent chain
 * reaches `folderId`). A `targetParentId` of `null` (moving to root) can
 * never create a cycle.
 */
export function wouldCreateFolderCycle(folderId: string, targetParentId: string | null, allFolders: MediaFolder[]): boolean {
  if (targetParentId === null) return false;
  if (targetParentId === folderId) return true;

  const byId = new Map(allFolders.map((folder) => [folder.id, folder]));
  let current: string | null = targetParentId;
  const visited = new Set<string>();

  while (current !== null) {
    if (current === folderId) return true;
    if (visited.has(current)) return false; // already-corrupt chain elsewhere; not this move's problem
    visited.add(current);
    current = byId.get(current)?.parent_folder_id ?? null;
  }

  return false;
}

export interface FolderMoveCheck {
  allowed: boolean;
  reason: string | null;
}

/**
 * Validates moving `folder` so its new parent is `targetParentId`. Refuses:
 * a target that doesn't exist, a cycle (see wouldCreateFolderCycle), moving
 * across Workspaces, or moving across owners (`owner_type`/`owner_id`) — a
 * folder always stays within the single owner it was created for (or stays
 * workspace-wide if it was created that way).
 */
export function canMoveFolder(folder: MediaFolder, targetParentId: string | null, allFolders: MediaFolder[]): FolderMoveCheck {
  if (targetParentId !== null) {
    const target = allFolders.find((candidate) => candidate.id === targetParentId);
    if (!target) {
      return { allowed: false, reason: "Target folder does not exist" };
    }
    if (target.workspace_id !== folder.workspace_id) {
      return { allowed: false, reason: "Cannot move a folder across Workspaces" };
    }
    if (target.owner_type !== folder.owner_type || target.owner_id !== folder.owner_id) {
      return { allowed: false, reason: "Cannot move a folder to a different owner" };
    }
  }

  if (wouldCreateFolderCycle(folder.id, targetParentId, allFolders)) {
    return { allowed: false, reason: "This move would create a circular folder relationship" };
  }

  return { allowed: true, reason: null };
}

/** Root-to-leaf path of folders ending at `folderId` (inclusive). Returns `[]` if `folderId` isn't found. */
export function getFolderPath(folderId: string, allFolders: MediaFolder[]): MediaFolder[] {
  const byId = new Map(allFolders.map((folder) => [folder.id, folder]));
  const path: MediaFolder[] = [];
  let current = byId.get(folderId);
  const visited = new Set<string>();

  while (current) {
    if (visited.has(current.id)) break; // defensive: never loop forever on a corrupt chain
    visited.add(current.id);
    path.unshift(current);
    current = current.parent_folder_id ? byId.get(current.parent_folder_id) : undefined;
  }

  return path;
}

/** Direct children of `parentFolderId` (`null` for root-level folders), sorted via sortFolders. */
export function getFolderChildren(parentFolderId: string | null, allFolders: MediaFolder[]): MediaFolder[] {
  return sortFolders(allFolders.filter((folder) => folder.parent_folder_id === parentFolderId));
}

/** Every descendant of `folderId` at any depth, not including `folderId` itself. */
export function getFolderDescendants(folderId: string, allFolders: MediaFolder[]): MediaFolder[] {
  const descendants: MediaFolder[] = [];
  const queue = getFolderChildren(folderId, allFolders);

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) continue;
    descendants.push(next);
    queue.push(...getFolderChildren(next.id, allFolders));
  }

  return descendants;
}

/** Stable display order: `sort_order` ascending, then `name` alphabetically as a tiebreaker. Never mutates the input array. */
export function sortFolders(folders: MediaFolder[]): MediaFolder[] {
  return [...folders].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });
}
