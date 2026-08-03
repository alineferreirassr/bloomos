"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { DataResult } from "@/lib/data/result";
import type { Event } from "@/types/event";

interface ConfirmEventActionModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => Promise<DataResult<Event>>;
  onConfirmed: (event: Event) => void;
}

/**
 * One reusable confirmation dialog for Archive/Cancel/Complete — all three
 * are terminal or destructive Event actions per the Phase 2 spec, so all
 * three get a confirmation step (unlike Restore, which is reversible and
 * therefore direct, matching ClientActions' Restore).
 */
export function ConfirmEventActionModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  pendingLabel,
  onConfirm,
  onConfirmed,
}: ConfirmEventActionModalProps) {
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
      const result = await onConfirm();
      if (!result.success) {
        setError(result.error);
        return;
      }
      onConfirmed(result.data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={title}>
      <p className="text-sm text-text-muted">{description}</p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleConfirm} disabled={submitting}>
          {submitting ? pendingLabel : confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
