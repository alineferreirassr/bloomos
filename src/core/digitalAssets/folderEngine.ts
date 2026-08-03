import type { MediaFolder } from "@/types/mediaFolder";
import type { MediaAsset } from "@/types/mediaAsset";
import { getFolderPath, getFolderChildren, getFolderDescendants, sortFolders, canMoveFolder, wouldCreateFolderCycle, type FolderMoveCheck } from "@/core/workflows/mediaFolderWorkflow";

/**
 * v2.0 Checkpoint 37, Step 3 — Folder Engine. Nested tree structure,
 * breadcrumbs, parent validation, circular-reference prevention, and move
 * validation are all real, existing logic in
 * `core/workflows/mediaFolderWorkflow.ts` (Checkpoint 25) — re-exported here
 * under the names this checkpoint's own spec uses, never reimplemented. The
 * one genuine gap this checkpoint closes is **delete validation**:
 * `archiveMediaFolder` (the real repository action) will happily archive a
 * folder that still has child folders or filed assets, silently orphaning
 * them (they simply stop appearing under any visible parent). This engine's
 * `canDeleteFolder` is the check callers should run first — see
 * `modules/digitalAssets/digitalAssetsActions.ts`'s own `moveFolderAction`
 * for the real call site.
 */
export { getFolderPath as getFolderBreadcrumbs, getFolderChildren, getFolderDescendants, sortFolders, canMoveFolder, wouldCreateFolderCycle, type FolderMoveCheck };

export interface FolderDeleteCheck {
  allowed: boolean;
  reason: string | null;
  blockingChildFolderCount: number;
  blockingAssetCount: number;
}

/**
 * A folder may only be archived once it has no active child folders and no
 * active (non-archived) assets still filed inside it — the folder's own
 * assets must be moved or unfiled first, and child folders archived or
 * moved out first. This mirrors the same "no dangling children" discipline
 * `wouldCreateFolderCycle`'s own sibling `canMoveFolder` already holds
 * moves to.
 */
export function canDeleteFolder(folderId: string, allFolders: MediaFolder[], allAssets: MediaAsset[]): FolderDeleteCheck {
  const activeChildFolders = getFolderChildren(folderId, allFolders).filter((folder) => !folder.archived_at);
  const activeAssetsInFolder = allAssets.filter((asset) => asset.folder_id === folderId && !asset.archived_at);

  if (activeChildFolders.length === 0 && activeAssetsInFolder.length === 0) {
    return { allowed: true, reason: null, blockingChildFolderCount: 0, blockingAssetCount: 0 };
  }

  const parts: string[] = [];
  if (activeChildFolders.length > 0) parts.push(`${activeChildFolders.length} sub-folder${activeChildFolders.length === 1 ? "" : "s"}`);
  if (activeAssetsInFolder.length > 0) parts.push(`${activeAssetsInFolder.length} file${activeAssetsInFolder.length === 1 ? "" : "s"}`);

  return {
    allowed: false,
    reason: `This folder still contains ${parts.join(" and ")}. Move or remove them first.`,
    blockingChildFolderCount: activeChildFolders.length,
    blockingAssetCount: activeAssetsInFolder.length,
  };
}

export interface FolderTreeNode {
  folder: MediaFolder;
  children: FolderTreeNode[];
  assetCount: number;
}

/** A full nested tree from `folders`/`assets`, rooted at `parentFolderId` (`null` for the workspace root) — the shape the Dashboard's Folders section (Step 17) and the Asset Detail breadcrumb both want, built once from the same flat arrays every other folder view already fetches. */
export function buildFolderTree(parentFolderId: string | null, folders: MediaFolder[], assets: MediaAsset[]): FolderTreeNode[] {
  return getFolderChildren(parentFolderId, folders).map((folder) => ({
    folder,
    children: buildFolderTree(folder.id, folders, assets),
    assetCount: assets.filter((asset) => asset.folder_id === folder.id && !asset.archived_at).length,
  }));
}
