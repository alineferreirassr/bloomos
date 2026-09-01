"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/forms/FormField";
import { getDocumentFolders } from "@/lib/data";
import { moveDocumentToFolderAction as moveDocumentToFolder } from "@/modules/documents/documentActions";
import type { DocumentFolder } from "@/types/documentFolder";
import type { Document } from "@/types/document";

interface MoveToFolderModalProps {
  open: boolean;
  onClose: () => void;
  document: Document;
  onChanged: (document: Document) => void;
}

export function MoveToFolderModal({ open, onClose, document: doc, onChanged }: MoveToFolderModalProps) {
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [folderId, setFolderId] = useState(doc.folder_id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    getDocumentFolders({ ownerType: doc.owner_type, ownerId: doc.owner_id }).then((result) => {
      setFolders(result);
      setFolderId(doc.folder_id ?? "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc.id]);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = await moveDocumentToFolder(doc.id, folderId === "" ? null : folderId);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onChanged(result.data);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Move to Folder">
      <p className="text-sm text-text-muted">
        Only folders belonging to this document&apos;s own owner are shown.
      </p>
      <div className="mt-4">
        <FormField label="Folder" htmlFor="move_folder_id">
          <Select id="move_folder_id" value={folderId} onChange={(event) => setFolderId(event.target.value)}>
            <option value="">No folder</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleConfirm} disabled={submitting || folderId === (doc.folder_id ?? "")}>
          {submitting ? "Moving…" : "Move"}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
