"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { DataResult } from "@/lib/data/result";
import type { Expense } from "@/types/expense";

interface ConfirmExpenseActionModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => Promise<DataResult<Expense>>;
  /** Called with the updated Expense on success, or with no argument on an unexpected thrown failure (see handleConfirm's catch) — every real caller today only ever uses this to trigger a refetch, so the argument is safely optional. */
  onConfirmed: (expense?: Expense) => void;
}

/**
 * One reusable confirmation dialog for every terminal-or-destructive Expense
 * action (Cancel, Archive) — mirrors ConfirmInvoiceActionModal/
 * ConfirmPaymentActionModal, typed to Expense. Approve/Mark Due/Mark Paid/
 * Mark Reimbursed skip this (procedural forward motion); Restore and
 * Duplicate skip it too (reversible / additive).
 */
export function ConfirmExpenseActionModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  pendingLabel,
  onConfirm,
  onConfirmed,
}: ConfirmExpenseActionModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await onConfirm();
      setSubmitting(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onConfirmed(result.data);
      onClose();
    } catch {
      // A genuinely unexpected failure (network/auth/out-of-taxonomy RPC
      // error) throws rather than resolving a DataResult — same contract
      // every Finance mutation shares (see ReverseDepositApplicationModal's
      // identical fix). Without this, the request would never resolve
      // `submitting`, permanently disabling both buttons. Refetch: the
      // underlying status transition may have already committed before a
      // separate follow-up Timeline write threw — refetching reconciles the
      // Founder's view with whatever actually committed.
      setSubmitting(false);
      setError("Something went wrong. Please try again.");
      onConfirmed();
    }
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
