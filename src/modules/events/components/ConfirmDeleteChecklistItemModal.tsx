"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { deleteChecklistItem } from "@/lib/data";

interface ConfirmDeleteChecklistItemModalProps {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemTitle: string;
  onDeleted: () => void;
}

/** deleteChecklistItem() itself refuses a completed item — this modal is only ever opened for a non-completed one. */
export function ConfirmDeleteChecklistItemModal({
  open,
  onClose,
  itemId,
  itemTitle,
  onDeleted,
}: ConfirmDeleteChecklistItemModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = await deleteChecklistItem(itemId);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onDeleted();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Delete Checklist Item">
      <p className="text-sm text-text-muted">
        This permanently removes <strong className="text-text">&quot;{itemTitle}&quot;</strong>{" "}
        from the checklist. This can&apos;t be undone.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Deleting…" : "Delete"}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
