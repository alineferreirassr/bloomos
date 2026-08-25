"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { getPaymentRefundableAmount, refundPayment } from "@/lib/data";
import { formatMoney, majorToMinor, minorToMajor } from "@/lib/money";
import type { Payment } from "@/types/payment";

interface RefundPaymentModalProps {
  open: boolean;
  onClose: () => void;
  payment: Payment;
  onRefunded: () => void;
}

/**
 * Uses the existing refundPayment() data-layer function exclusively — this
 * component never mutates a Payment/Invoice directly. The refundable ceiling
 * comes from getPaymentRefundableAmount() (the same figure refundPayment()
 * itself enforces), so the amount input can never even be set above what
 * the data layer would accept; refundPayment() still re-validates on submit
 * as the final authority.
 */
export function RefundPaymentModal({ open, onClose, payment, onRefunded }: RefundPaymentModalProps) {
  const [refundableMinor, setRefundableMinor] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Finance F2.1C-C-IDEMPOTENCY: generated ONCE per modal open (one
  // intended "refund this payment" user operation), reused across any
  // retry of this same submit attempt — never regenerated on retry, or
  // the idempotency key would defeat its own purpose. Derived with
  // useMemo (not set inside the effect below) so opening the modal never
  // triggers an extra render — a fresh key is produced only when `open`
  // itself changes, correctly treating a reopen as a new, distinct
  // potential operation.
  const refundPaymentId = useMemo(() => (open ? crypto.randomUUID() : null), [open]);

  useEffect(() => {
    if (!open) return;
    getPaymentRefundableAmount(payment.id).then((refundable) => {
      setError(null);
      setRefundableMinor(refundable);
      setAmount(minorToMajor(refundable).toString());
    });
  }, [open, payment.id]);

  if (!open) return null;

  const amountMinor = amount === "" || Number.isNaN(Number(amount)) ? null : majorToMinor(Number(amount));
  const exceedsRefundable = amountMinor !== null && refundableMinor !== null && amountMinor > refundableMinor;
  const isFullRefund = refundableMinor !== null && amountMinor === refundableMinor;

  const handleConfirm = async () => {
    if (amountMinor === null || amountMinor <= 0 || exceedsRefundable || !refundPaymentId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await refundPayment(payment.id, amountMinor, refundPaymentId);
      setSubmitting(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onRefunded();
      onClose();
    } catch {
      // A genuinely unexpected failure (network/auth/out-of-taxonomy RPC
      // error) throws rather than resolving a DataResult — same contract
      // every Finance mutation shares (see ReverseDepositApplicationModal's
      // identical fix). Without this, the request would never resolve
      // `submitting`, permanently disabling both buttons. Refetch: the
      // refund itself may have already committed before a follow-up
      // invoice-balance recompute call threw — refetching reconciles the
      // Founder's view with whatever actually committed, and a same-ID
      // retry safely completes the recompute step either way.
      setSubmitting(false);
      setError("Something went wrong. Please try again.");
      onRefunded();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Refund Payment">
      <p className="text-sm text-text-muted">
        Refunding this payment creates a new refund record and updates the linked invoice immediately.
      </p>
      <p className="mt-2 text-sm text-text">
        Refundable amount:{" "}
        <span className="font-medium">
          {refundableMinor === null ? "Loading…" : formatMoney(refundableMinor, payment.currency)}
        </span>
      </p>
      <div className="mt-4">
        <FormField
          label="Refund amount"
          htmlFor="refund_amount"
          required
          hint={isFullRefund ? "Full refund" : "Partial refund"}
        >
          <Input
            id="refund_amount"
            type="number"
            min={0}
            step="0.01"
            invalid={exceedsRefundable}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={refundableMinor === null}
          />
        </FormField>
        {exceedsRefundable ? (
          <p role="alert" className="mt-1 text-xs text-danger">
            Cannot refund more than the refundable amount.
          </p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-3">
        <Button
          onClick={handleConfirm}
          disabled={submitting || amountMinor === null || amountMinor <= 0 || exceedsRefundable || !refundPaymentId}
        >
          {submitting ? "Refunding…" : "Refund"}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
