import type { MediaFolder } from "@/types/mediaFolder";
import { getFolderChildren } from "@/core/workflows/mediaFolderWorkflow";
import { Card } from "@/components/ui/Card";

interface AssetFolderSidebarProps {
  folders: MediaFolder[];
  activeFolderId: string | null | "all";
  onSelectFolder: (folderId: string | null | "all") => void;
  totalAssetCount: number;
}

function FolderNode({
  folder,
  folders,
  activeFolderId,
  onSelectFolder,
  depth,
}: {
  folder: MediaFolder;
  folders: MediaFolder[];
  activeFolderId: string | null | "all";
  onSelectFolder: (id: string | null | "all") => void;
  depth: number;
}) {
  const children = getFolderChildren(folder.id, folders);
  const isActive = activeFolderId === folder.id;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelectFolder(folder.id)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={`w-full rounded-md py-1.5 pr-2 text-left text-sm ${isActive ? "bg-accent/10 font-medium text-accent" : "text-text hover:bg-text/5"}`}
      >
        {folder.name}
      </button>
      {children.length > 0 ? (
        <ul>
          {children.map((child) => (
            <FolderNode key={child.id} folder={child} folders={folders} activeFolderId={activeFolderId} onSelectFolder={onSelectFolder} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** v2.0 Checkpoint 25, Step 3 — Folder tree navigation for the Asset Library, mirroring the Document Platform's own folder sidebar structurally (tree built from `getFolderChildren`), adapted for workspace-wide MediaFolders. */
export function AssetFolderSidebar({ folders, activeFolderId, onSelectFolder, totalAssetCount }: AssetFolderSidebarProps) {
  const roots = getFolderChildren(null, folders);

  return (
    <Card className="w-full shrink-0 lg:w-56">
      <nav aria-label="Asset folders">
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => onSelectFolder("all")}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${activeFolderId === "all" ? "bg-accent/10 font-medium text-accent" : "text-text hover:bg-text/5"}`}
            >
              <span>All Assets</span>
              <span className="text-xs text-text-muted">{totalAssetCount}</span>
            </button>
          </li>
          {roots.map((folder) => (
            <FolderNode key={folder.id} folder={folder} folders={folders} activeFolderId={activeFolderId} onSelectFolder={onSelectFolder} depth={0} />
          ))}
        </ul>
      </nav>
    </Card>
  );
}
