"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { deleteContractExhibit } from "@/lib/data";

interface ConfirmDeleteExhibitModalProps {
  open: boolean;
  onClose: () => void;
  exhibitId: string;
  exhibitTitle: string;
  onDeleted: () => void;
}

export function ConfirmDeleteExhibitModal({
  open,
  onClose,
  exhibitId,
  exhibitTitle,
  onDeleted,
}: ConfirmDeleteExhibitModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = await deleteContractExhibit(exhibitId);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onDeleted();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Remove Exhibit">
      <p className="text-sm text-text-muted">
        This permanently removes <strong className="text-text">&quot;{exhibitTitle}&quot;</strong>{" "}
        from the contract. This can&apos;t be undone.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Removing…" : "Remove"}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
