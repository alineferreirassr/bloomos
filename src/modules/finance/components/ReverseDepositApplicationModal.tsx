"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/forms/FormField";
import { Textarea } from "@/components/ui/Textarea";
import { reverseDepositApplication } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import type { Payment } from "@/types/payment";

interface ReverseDepositApplicationModalProps {
  open: boolean;
  onClose: () => void;
  /** The Deposit Application payment row itself (payment_type "adjustment", reference "deposit_application_of:<depositId>"). */
  payment: Payment;
  onReversed: () => void;
}

/**
 * Uses the existing reverseDepositApplication() data-layer function
 * exclusively — this component never mutates a Payment/Invoice/Deposit
 * directly. FULL_ONLY: the reversed amount is always this Application's own
 * full amount_minor, so there is no amount input — the preview figures
 * below are read-only, sourced straight from the Application row.
 *
 * Uses the same stable per-open idempotency-key lifecycle as
 * VoidInvoiceModal/InvoiceAdjustmentModal/RefundPaymentModal.
 */
export function ReverseDepositApplicationModal({ open, onClose, payment, onReversed }: ReverseDepositApplicationModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reversalId = useMemo(() => (open ? crypto.randomUUID() : null), [open]);

  // Reset reason/error on open — adjusted during render, same rationale as
  // VoidInvoiceModal/InvoiceAdjustmentModal's own identical pattern.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason("");
      setError(null);
    }
  }

  if (!open) return null;

  const reasonValid = reason.trim().length > 0;
  const canSubmit = !submitting && !!reversalId && reasonValid;

  const handleConfirm = async () => {
    if (!canSubmit || !reversalId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await reverseDepositApplication(payment.id, reversalId, reason.trim());
      setSubmitting(false);
      if (!result.success) {
        setError(result.error);
        // Refetch even on failure: a rejection here (most notably "already
        // reversed by someone else") means state has moved since this page
        // loaded. Refetching is a safe, idempotent read that keeps the
        // parent's eligibility derivation correct without us having to parse
        // the engine's error text to decide when it's warranted.
        onReversed();
        return;
      }
      onReversed();
      onClose();
    } catch {
      // A genuinely unexpected failure (network/auth/out-of-taxonomy RPC
      // error) throws rather than resolving a DataResult — same contract
      // every Finance mutation shares. Without this, the request would
      // never resolve `submitting`, permanently disabling both buttons.
      setSubmitting(false);
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Reverse Deposit Application">
      <p className="text-sm text-text-muted">
        This reverses the Customer Deposit Application in full. The{" "}
        <span className="font-medium text-text">{formatMoney(payment.amount_minor, payment.currency)}</span> applied
        amount returns to the Customer Deposit&apos;s available balance, and the invoice&apos;s Accounts Receivable
        balance is restored by the same amount. Partial reversal is not supported.
      </p>
      <p className="mt-2 text-sm text-text-muted">
        This is not a Payment Refund — no money leaves the business and nothing is returned to the client.
      </p>

      <div className="mt-3 rounded-md border border-border bg-text/[0.03] p-3 text-xs">
        <PreviewRow label="Amount being reversed" value={formatMoney(payment.amount_minor, payment.currency)} />
        <PreviewRow label="Returns to" value="Customer Deposit available balance" />
        <PreviewRow label="Restores" value="Invoice Accounts Receivable balance" />
      </div>

      <div className="mt-4">
        <FormField label="Reason" htmlFor="reversal_reason" required>
          <Textarea
            id="reversal_reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Deposit was applied to the wrong invoice"
            disabled={submitting}
          />
        </FormField>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleConfirm} disabled={!canSubmit}>
          {submitting ? "Reversing…" : "Reverse Application"}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text">{value}</span>
    </div>
  );
}
