"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { deleteScheduleItem } from "@/lib/data";

interface ConfirmDeleteScheduleItemModalProps {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemTitle: string;
  onDeleted: () => void;
}

export function ConfirmDeleteScheduleItemModal({
  open,
  onClose,
  itemId,
  itemTitle,
  onDeleted,
}: ConfirmDeleteScheduleItemModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await deleteScheduleItem(itemId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this item. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Delete Schedule Item">
      <p className="text-sm text-text-muted">
        This permanently removes <strong className="text-text">&quot;{itemTitle}&quot;</strong>{" "}
        from the schedule. This can&apos;t be undone.
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
