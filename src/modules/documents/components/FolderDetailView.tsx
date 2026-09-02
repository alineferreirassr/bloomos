"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createDocumentFolderNote,
  getDocumentFolderById,
  getDocumentFolderPath,
  getDocumentFolderTree,
  getDocuments,
  getNotesByDocumentFolderId,
  getTimelineByDocumentFolderId,
  togglePinNote,
  type DocumentFolderTreeNode,
} from "@/lib/data";
import type { DocumentFolder } from "@/types/documentFolder";
import type { Document } from "@/types/document";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import { NotFoundError } from "@/core/errors";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotesSection } from "@/modules/notes/components/NotesSection";
import { Timeline } from "@/modules/timeline/components/Timeline";
import { DocumentVisibilityBadge } from "@/modules/documents/components/DocumentVisibilityBadge";
import { DocumentStatusBadge } from "@/modules/documents/components/DocumentStatusBadge";
import { FolderActions } from "@/modules/documents/components/FolderActions";
import { FolderTree } from "@/modules/documents/components/FolderTree";
import { OWNER_TYPE_LABELS } from "@/modules/documents/components/DocumentFilters";
import { formatBytes } from "@/modules/documents/mappers";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | {
      status: "ready";
      folder: DocumentFolder;
      path: DocumentFolder[];
      subtree: DocumentFolderTreeNode[];
      documents: Document[];
      notes: Note[];
      timeline: TimelineActivity[];
    };

function findNode(nodes: DocumentFolderTreeNode[], folderId: string): DocumentFolderTreeNode | null {
  for (const node of nodes) {
    if (node.folder.id === folderId) return node;
    const found = findNode(node.children, folderId);
    if (found) return found;
  }
  return null;
}

async function loadFolderDetail(folderId: string): Promise<LoadState> {
  try {
    const folder = await getDocumentFolderById(folderId);
    const [path, tree, documents, notes, timeline] = await Promise.all([
      getDocumentFolderPath(folderId),
      getDocumentFolderTree(folder.owner_type, folder.owner_id),
      getDocuments({ folderId, includeArchived: true, includeDeleted: true }),
      getNotesByDocumentFolderId(folderId),
      getTimelineByDocumentFolderId(folderId),
    ]);
    const node = findNode(tree, folderId);
    return { status: "ready", folder, path, subtree: node?.children ?? [], documents, notes, timeline };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

export function FolderDetailView({ folderId }: { folderId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadFolderDetail(folderId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [folderId]);

  const refetch = () => {
    loadFolderDetail(folderId).then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This folder could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this folder." onRetry={refetch} />;
  }

  const { folder, path, subtree, documents, notes, timeline } = state;
  const isArchived = folder.archived_at !== null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/documents" className="text-sm text-accent hover:underline">
          ← Back to Documents
        </Link>
        <nav className="mt-2 flex flex-wrap items-center gap-1 text-sm text-text-muted" aria-label="Folder path">
          {path.map((crumb, index) => (
            <span key={crumb.id} className="flex items-center gap-1">
              {index > 0 ? <span>/</span> : null}
              {crumb.id === folder.id ? (
                <span className="font-medium text-text">{crumb.name}</span>
              ) : (
                <Link href={`/documents/folders/${crumb.id}`} className="hover:text-accent hover:underline">
                  {crumb.name}
                </Link>
              )}
            </span>
          ))}
        </nav>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-3xl font-semibold text-text">{folder.name}</h2>
          <DocumentVisibilityBadge visibility={folder.visibility} />
          {isArchived ? <span className="text-xs text-text-muted">(archived)</span> : null}
        </div>
        <p className="mt-1 text-sm text-text-muted">{OWNER_TYPE_LABELS[folder.owner_type]}</p>
        {folder.description ? <p className="mt-1 text-sm text-text">{folder.description}</p> : null}

        <div className="mt-4">
          <FolderActions folder={folder} childCount={subtree.length} onChanged={refetch} />
        </div>
      </div>

      {isArchived ? (
        <LuxuryCard className="border-danger/40 bg-danger/5">
          <p className="text-sm text-danger">This folder is archived. Restore it to add or move items into it.</p>
        </LuxuryCard>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <LuxuryCard>
            <h3 className="font-serif text-[17px] font-semibold text-text">Child Folders</h3>
            {subtree.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No subfolders yet.</p>
            ) : (
              <div className="mt-3">
                <FolderTree nodes={subtree} />
              </div>
            )}
          </LuxuryCard>

          <LuxuryCard>
            <h3 className="font-serif text-[17px] font-semibold text-text">Documents in this Folder</h3>
            {documents.length === 0 ? (
              <EmptyState
                title="No documents in this folder"
                description="Move a document here from its detail page, or add a new one directly to this owner."
              />
            ) : (
              <ul className="mt-3 space-y-2" data-testid="folder-document-list">
                {documents.map((document) => (
                  <li key={document.id}>
                    <Link
                      href={`/documents/${document.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:border-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{document.title}</p>
                        <p className="mt-0.5 text-xs text-text-muted">
                          {document.file_name ?? "No file attached"}
                          {document.size_bytes !== null ? ` · ${formatBytes(document.size_bytes)}` : ""}
                        </p>
                      </div>
                      <DocumentStatusBadge status={document.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </LuxuryCard>

          <LuxuryCard>
            <h3 className="font-serif text-[17px] font-semibold text-text">Notes</h3>
            <div className="mt-3">
              <NotesSection
                workspaceId={folder.workspace_id}
                ownerType="document_folder"
                ownerId={folder.id}
                notes={notes}
                onCreateNote={(input) => createDocumentFolderNote(folder.id, input)}
                onTogglePin={togglePinNote}
                readOnly={isArchived}
                onNotesChanged={refetch}
              />
            </div>
          </LuxuryCard>
        </div>

        <div className="space-y-6">
          <LuxuryCard>
            <h3 className="font-serif text-[17px] font-semibold text-text">Timeline</h3>
            <div className="mt-3">
              <Timeline activities={timeline} />
            </div>
          </LuxuryCard>
        </div>
      </div>
    </div>
  );
}
