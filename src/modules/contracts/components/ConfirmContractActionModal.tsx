"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { DataResult } from "@/lib/data/result";
import type { Contract } from "@/types/contract";

interface ConfirmContractActionModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => Promise<DataResult<Contract>>;
  onConfirmed: (contract: Contract) => void;
}

/**
 * One reusable confirmation dialog for every terminal-or-destructive
 * Contract action (Send, Mark Signed, Mark Declined, Expire, Cancel,
 * Complete, Archive) — mirrors ConfirmEventActionModal exactly, typed to
 * Contract instead of Event. Mark Viewed, Restore, and Duplicate skip this:
 * Mark Viewed is a passive/low-stakes tracking action, Restore is
 * reversible (same precedent as EventActions' Restore), and Duplicate is
 * purely additive — none of them alter or lock the existing record.
 */
export function ConfirmContractActionModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  pendingLabel,
  onConfirm,
  onConfirmed,
}: ConfirmContractActionModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = await onConfirm();
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onConfirmed(result.data);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
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
