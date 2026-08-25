"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { closeAccountingPeriod } from "@/lib/data";
import type { AccountingPeriod } from "@/types/accountingPeriod";

interface ClosePeriodDialogProps {
  open: boolean;
  onClose: () => void;
  period: AccountingPeriod;
  /** Called with the updated AccountingPeriod on success, or with no argument on an unexpected thrown failure (see handleConfirm's catch) — the real caller today only ever uses this to trigger a refetch, so the argument is safely optional. */
  onClosed: (period?: AccountingPeriod) => void;
}

export function ClosePeriodDialog({ open, onClose, period, onClosed }: ClosePeriodDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await closeAccountingPeriod(period.id);
      setSubmitting(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onClosed(result.data);
      onClose();
    } catch {
      // A genuinely unexpected failure (network/auth/out-of-taxonomy RPC
      // error) throws rather than resolving a DataResult — same contract
      // every Finance mutation shares (see ReverseDepositApplicationModal's
      // identical fix). Without this, the request would never resolve
      // `submitting`, permanently disabling both buttons. Refetch: the
      // period's status may have already committed before a separate
      // follow-up write threw — refetching reconciles the Founder's view
      // with whatever actually committed; a retry safely rejects via the
      // period's own status guard rather than closing it twice.
      setSubmitting(false);
      setError("Something went wrong. Please try again.");
      onClosed();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Close Accounting Period">
      <div className="space-y-2 text-sm text-text-muted">
        <p>This closes the period and may restrict normal posting behavior into it afterward.</p>
        <p>A closed period can still be locked later, and a Reversal can still post into a closed period when needed.</p>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Closing…" : "Close Period"}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
