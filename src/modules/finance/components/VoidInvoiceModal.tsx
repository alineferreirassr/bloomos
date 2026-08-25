"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/forms/FormField";
import { Textarea } from "@/components/ui/Textarea";
import { voidInvoice } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import type { Invoice } from "@/types/invoice";

interface VoidInvoiceModalProps {
  open: boolean;
  invoice: Invoice;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Replaces ConfirmInvoiceActionModal for the Void action specifically
 * (Archive keeps using ConfirmInvoiceActionModal unchanged). Branches
 * purely off the already-fetched Invoice's own paid_minor/balance_minor —
 * Clean Void (paid_minor === 0) vs Partial-Payment Cancellation
 * (paid_minor > 0 && balance_minor > 0). Uses the same stable per-open
 * idempotency-key lifecycle as InvoiceAdjustmentModal/RefundPaymentModal —
 * this fixes a genuine retry-safety gap in the prior wiring, which
 * generated a fresh crypto.randomUUID() on every confirm click.
 */
export function VoidInvoiceModal({ open, invoice, onClose, onChanged }: VoidInvoiceModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancellationId = useMemo(() => (open ? crypto.randomUUID() : null), [open]);

  // Reset the reason/error on open — adjusted during render rather than in
  // a useEffect, same rationale as InvoiceAdjustmentModal.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason("");
      setError(null);
    }
  }

  if (!open) return null;

  const isPartial = invoice.paid_minor > 0 && invoice.balance_minor > 0;
  const reasonValid = reason.trim().length > 0;
  const canSubmit = !submitting && !!cancellationId && reasonValid;

  const handleConfirm = async () => {
    if (!canSubmit || !cancellationId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await voidInvoice(invoice.id, cancellationId, reason.trim());
      setSubmitting(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onChanged();
      onClose();
    } catch {
      // A genuinely unexpected failure (network/auth/out-of-taxonomy RPC
      // error) throws rather than resolving a DataResult — same contract
      // every Finance mutation shares (see ReverseDepositApplicationModal's
      // identical fix). Without this, the request would never resolve
      // `submitting`, permanently disabling both buttons. Refetch: Clean
      // Void's own follow-up Timeline write can throw after the invoice is
      // already voided server-side — refetching reconciles the Founder's
      // view with whatever actually committed.
      setSubmitting(false);
      setError("Something went wrong. Please try again.");
      onChanged();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Void Invoice">
      {isPartial ? (
        <>
          <p className="text-sm text-text-muted">
            Voiding this invoice cancels the unpaid remainder. The {formatMoney(invoice.paid_minor, invoice.currency)}{" "}
            already collected stays recorded as revenue and will not be refunded. The outstanding balance becomes{" "}
            {formatMoney(0, invoice.currency)}. No money moves.
          </p>
          <div className="mt-3 rounded-md border border-border bg-text/[0.03] p-3 text-xs">
            <PreviewRow label="Current total" value={formatMoney(invoice.total_minor, invoice.currency)} />
            <PreviewRow label="Already settled" value={formatMoney(invoice.paid_minor, invoice.currency)} />
            <PreviewRow label="Amount being cancelled" value={formatMoney(invoice.balance_minor, invoice.currency)} />
            <PreviewRow label="Final outstanding balance" value={formatMoney(0, invoice.currency)} />
          </div>
        </>
      ) : (
        <p className="text-sm text-text-muted">
          This marks &quot;{invoice.title}&quot; as voided. No payments have been applied, so the recognized revenue
          is fully reversed. This is a terminal state and can&apos;t be undone from here.
        </p>
      )}

      <div className="mt-4">
        <FormField label="Reason" htmlFor="void_reason" required>
          <Textarea
            id="void_reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Client requested cancellation of the remaining balance"
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
          {submitting ? "Voiding…" : "Void"}
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
