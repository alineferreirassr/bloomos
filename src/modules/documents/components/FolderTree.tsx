"use client";

import { useState } from "react";
import Link from "next/link";
import type { DocumentFolderTreeNode } from "@/lib/data";

/**
 * Renders a nested folder tree with per-node expand/collapse — never
 * reimplements tree-building itself, only the presentation. The actual
 * parent/child structure always comes from getDocumentFolderTree()
 * (lib/data/index.ts), which in turn is built from the centralized
 * core/workflows/documentFolderWorkflow.ts helpers.
 */
export function FolderTree({ nodes, activeFolderId }: { nodes: DocumentFolderTreeNode[]; activeFolderId?: string }) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <FolderTreeNode key={node.folder.id} node={node} activeFolderId={activeFolderId} depth={0} />
      ))}
    </ul>
  );
}

function FolderTreeNode({
  node,
  activeFolderId,
  depth,
}: {
  node: DocumentFolderTreeNode;
  activeFolderId?: string;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isActive = node.folder.id === activeFolderId;

  return (
    <li>
      <div className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? "Collapse folder" : "Expand folder"}
            className="flex h-5 w-5 shrink-0 items-center justify-center text-text-muted hover:text-text"
          >
            {expanded ? "−" : "+"}
          </button>
        ) : (
          <span className="inline-block h-5 w-5 shrink-0" />
        )}
        <Link
          href={`/documents/folders/${node.folder.id}`}
          className={`truncate text-sm ${isActive ? "font-semibold text-accent" : "text-text hover:text-accent"}`}
        >
          {node.folder.name}
          {node.folder.archived_at ? <span className="ml-1.5 text-xs text-text-muted">(archived)</span> : null}
        </Link>
      </div>
      {hasChildren && expanded ? (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <FolderTreeNode key={child.folder.id} node={child} activeFolderId={activeFolderId} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
