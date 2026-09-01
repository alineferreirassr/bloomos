"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/forms/FormField";
import { getDocumentFolders } from "@/lib/data";
import { moveDocumentFolderAction as moveDocumentFolder } from "@/modules/documents/documentActions";
import type { DocumentFolder } from "@/types/documentFolder";

interface MoveFolderModalProps {
  open: boolean;
  onClose: () => void;
  folder: DocumentFolder;
  onMoved: (folder: DocumentFolder) => void;
}

/**
 * Lets the user pick any other folder belonging to the same owner as the
 * new parent (or root). Cycle prevention and the "no different owner" rule
 * are enforced centrally by moveDocumentFolder — this modal doesn't filter
 * out invalid targets itself, it just surfaces whatever error comes back.
 */
export function MoveFolderModal({ open, onClose, folder, onMoved }: MoveFolderModalProps) {
  const [candidates, setCandidates] = useState<DocumentFolder[]>([]);
  const [parentFolderId, setParentFolderId] = useState(folder.parent_folder_id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    getDocumentFolders({ ownerType: folder.owner_type, ownerId: folder.owner_id, includeArchived: true }).then(
      (result) => {
        setCandidates(result.filter((candidate) => candidate.id !== folder.id));
        setParentFolderId(folder.parent_folder_id ?? "");
        setError(null);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, folder.id]);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = await moveDocumentFolder(folder.id, parentFolderId === "" ? null : parentFolderId);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onMoved(result.data);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Move Folder">
      <div className="mt-1">
        <FormField label="New parent folder" htmlFor="move_parent_folder_id" hint="Leave as root to move it to the top level">
          <Select id="move_parent_folder_id" value={parentFolderId} onChange={(event) => setParentFolderId(event.target.value)}>
            <option value="">Root (no parent)</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
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
        <Button onClick={handleConfirm} disabled={submitting || parentFolderId === (folder.parent_folder_id ?? "")}>
          {submitting ? "Moving…" : "Move"}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
