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
  onClosed: (period: AccountingPeriod) => void;
}

export function ClosePeriodDialog({ open, onClose, period, onClosed }: ClosePeriodDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    const result = await closeAccountingPeriod(period.id);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onClosed(result.data);
    onClose();
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
