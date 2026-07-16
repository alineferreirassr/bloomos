"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { archiveDocumentFolder, createDocumentFolder, restoreDocumentFolder, updateDocumentFolder } from "@/lib/data";
import type { DocumentFolder } from "@/types/documentFolder";
import { FolderFormModal } from "@/modules/documents/components/FolderFormModal";
import { MoveFolderModal } from "@/modules/documents/components/MoveFolderModal";
import { ApplyFolderTemplateModal } from "@/modules/documents/components/ApplyFolderTemplateModal";

interface FolderActionsProps {
  folder: DocumentFolder;
  childCount: number;
  onChanged: () => void;
}

type ModalKind = "rename" | "addSubfolder" | "move" | "applyTemplate" | null;

export function FolderActions({ folder, childCount, onChanged }: FolderActionsProps) {
  const [modal, setModal] = useState<ModalKind>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isArchived = folder.archived_at !== null;

  const runAction = async (name: string, action: () => Promise<{ success: boolean; error?: string }>) => {
    setBusyAction(name);
    setActionError(null);
    const result = await action();
    setBusyAction(null);
    if (!result.success) {
      setActionError(result.error ?? "Something went wrong.");
      return;
    }
    onChanged();
  };

  if (isArchived) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => runAction("restore", () => restoreDocumentFolder(folder.id))}
            disabled={busyAction === "restore"}
          >
            {busyAction === "restore" ? "Restoring…" : "Restore"}
          </Button>
        </div>
        {actionError ? (
          <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
            {actionError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setModal("addSubfolder")}>
          Add Subfolder
        </Button>
        <Button variant="secondary" onClick={() => setModal("rename")}>
          Rename
        </Button>
        <Button variant="secondary" onClick={() => setModal("move")}>
          Move
        </Button>
        <Button variant="secondary" onClick={() => setModal("applyTemplate")}>
          Apply Default Template
        </Button>
        <Button
          variant="secondary"
          onClick={() => runAction("archive", () => archiveDocumentFolder(folder.id))}
          disabled={busyAction === "archive"}
        >
          {busyAction === "archive" ? "Archiving…" : "Archive"}
        </Button>
      </div>

      {actionError ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {actionError}
        </p>
      ) : null}

      <FolderFormModal
        open={modal === "rename"}
        onClose={() => setModal(null)}
        title="Rename Folder"
        submitLabel="Save"
        defaultValues={{ name: folder.name, description: folder.description ?? "", visibility: folder.visibility }}
        onSubmit={(values) =>
          updateDocumentFolder(folder.id, {
            name: values.name,
            description: values.description === "" ? null : values.description,
            sort_order: folder.sort_order,
            visibility: values.visibility,
          })
        }
        onSaved={onChanged}
      />

      <FolderFormModal
        open={modal === "addSubfolder"}
        onClose={() => setModal(null)}
        title="Add Subfolder"
        submitLabel="Create"
        defaultValues={{ name: "", description: "", visibility: "internal" }}
        onSubmit={(values) =>
          createDocumentFolder({
            owner_type: folder.owner_type,
            owner_id: folder.owner_id,
            parent_folder_id: folder.id,
            name: values.name,
            description: values.description === "" ? null : values.description,
            sort_order: childCount,
            visibility: values.visibility,
          })
        }
        onSaved={onChanged}
      />

      <MoveFolderModal open={modal === "move"} onClose={() => setModal(null)} folder={folder} onMoved={onChanged} />

      <ApplyFolderTemplateModal
        open={modal === "applyTemplate"}
        onClose={() => setModal(null)}
        folder={folder}
        onApplied={onChanged}
      />
    </div>
  );
}
