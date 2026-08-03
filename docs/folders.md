# Digital Asset Folders

`core/digitalAssets/folderEngine.ts`, composing `core/workflows/mediaFolderWorkflow.ts` (Checkpoint 25) rather than reimplementing folder logic.

## What already existed

Nested tree structure, breadcrumbs (`getFolderPath`), parent validation, and circular-reference prevention (`wouldCreateFolderCycle`) were all real, working, and tested before this checkpoint — `folderEngine.ts` re-exports them under this checkpoint's own naming (`getFolderBreadcrumbs`, `getFolderChildren`, `getFolderDescendants`, `sortFolders`, `canMoveFolder`, `wouldCreateFolderCycle`) rather than duplicating a single line of that logic.

## What this checkpoint adds

**Delete validation** (`canDeleteFolder`) — the one real gap: the existing `archiveMediaFolder` repository action will happily archive a folder that still has active child folders or filed assets, silently orphaning them. `canDeleteFolder` checks both before `archiveAssetFolderAction` (Step 15) calls the real archive action, refusing with a specific count of blocking sub-folders/files rather than a generic error.

**`buildFolderTree`** — a full nested tree (folder + children + per-folder asset count) built once from the same flat `folders[]`/`assets[]` arrays every existing folder view already fetches. Powers the Dashboard's own Folders section (Step 17).

## Named functions

| Function | Purpose |
|---|---|
| `canDeleteFolder(folderId, folders, assets)` | Refuses to delete a folder with active children or filed assets |
| `buildFolderTree(parentFolderId, folders, assets)` | Nested `FolderTreeNode[]` with per-folder asset counts |
| `getFolderBreadcrumbs` / `getFolderChildren` / `getFolderDescendants` / `sortFolders` / `canMoveFolder` / `wouldCreateFolderCycle` | Re-exported from `mediaFolderWorkflow.ts`, unchanged |
