"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { recordInvoiceAdjustment } from "@/lib/data";
import { formatMoney, majorToMinor, minorToMajor } from "@/lib/money";
import { invoiceAdjustmentFormSchema, invoiceAdjustmentFormToInput } from "@/modules/finance/schema";
import type { Invoice } from "@/types/invoice";

interface InvoiceAdjustmentModalProps {
  open: boolean;
  invoice: Invoice;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Uses the existing recordInvoiceAdjustment() data-layer function
 * exclusively — this component never mutates an Invoice directly. Modeled
 * on RefundPaymentModal's architecture (stable per-open idempotency key,
 * locally-derived validation, formatMoney preview, verbatim server error).
 * Prepopulates from the Invoice's CURRENT economic fields (not the original
 * issue values) since this corrects the invoice as it stands today; the
 * server remains sole authority on every submit regardless of what this
 * preview shows.
 */
export function InvoiceAdjustmentModal({ open, invoice, onClose, onChanged }: InvoiceAdjustmentModalProps) {
  const [subtotal, setSubtotal] = useState(() => minorToMajor(invoice.subtotal_minor).toString());
  const [tax, setTax] = useState(() => minorToMajor(invoice.tax_minor).toString());
  const [discount, setDiscount] = useState(() => minorToMajor(invoice.discount_minor).toString());
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Finance F2.1C-D-E-B: same lifecycle as RefundPaymentModal's
  // refundPaymentId — generated ONCE per modal open, reused across any
  // retry of this same submit attempt, regenerated only when the modal is
  // reopened (a genuinely new operation).
  const adjustmentId = useMemo(() => (open ? crypto.randomUUID() : null), [open]);

  // Reset the form to the Invoice's CURRENT economic fields whenever the
  // modal transitions to open — adjusted during render (React's documented
  // alternative to an Effect for "reset state when a prop changes") rather
  // than in a useEffect, which would call setState synchronously in the
  // effect body and trigger an avoidable extra render.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSubtotal(minorToMajor(invoice.subtotal_minor).toString());
      setTax(minorToMajor(invoice.tax_minor).toString());
      setDiscount(minorToMajor(invoice.discount_minor).toString());
      setReason("");
      setError(null);
    }
  }

  if (!open) return null;

  const toMinor = (value: string): number | null => (value === "" || Number.isNaN(Number(value)) ? null : majorToMinor(Number(value)));
  const newSubtotalMinor = toMinor(subtotal);
  const newTaxMinor = toMinor(tax);
  const newDiscountMinor = toMinor(discount);
  const amountsValid = newSubtotalMinor !== null && newTaxMinor !== null && newDiscountMinor !== null;
  const newTotalMinor = amountsValid ? newSubtotalMinor + newTaxMinor - newDiscountMinor : null;
  const newBalanceMinor = newTotalMinor === null ? null : newTotalMinor - invoice.paid_minor;
  const deltaMinor = newTotalMinor === null ? null : newTotalMinor - invoice.total_minor;

  const wouldUnderpaySettled = newTotalMinor !== null && newTotalMinor < invoice.paid_minor;
  const financialValuesChanged =
    amountsValid &&
    (newSubtotalMinor !== invoice.subtotal_minor || newTaxMinor !== invoice.tax_minor || newDiscountMinor !== invoice.discount_minor);
  const reasonValid = reason.trim().length > 0;
  const canSubmit =
    !submitting && !!adjustmentId && amountsValid && !wouldUnderpaySettled && financialValuesChanged && reasonValid;

  const handleConfirm = async () => {
    if (!canSubmit || !adjustmentId) return;
    const parsed = invoiceAdjustmentFormSchema.safeParse({ subtotal, tax, discount, reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid adjustment.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await recordInvoiceAdjustment(invoice.id, invoiceAdjustmentFormToInput(parsed.data), adjustmentId);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onChanged();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Adjust Invoice">
      <p className="text-sm text-text-muted">
        Correct this invoice&apos;s billed amounts. The total is derived automatically and the change is recorded on
        the invoice&apos;s history.
      </p>

      <div className="mt-4 space-y-3">
        <FormField label="New subtotal" htmlFor="adjustment_subtotal" required>
          <Input
            id="adjustment_subtotal"
            type="number"
            min={0}
            step="0.01"
            value={subtotal}
            onChange={(event) => setSubtotal(event.target.value)}
            disabled={submitting}
          />
        </FormField>
        <FormField label="New tax" htmlFor="adjustment_tax" required>
          <Input
            id="adjustment_tax"
            type="number"
            min={0}
            step="0.01"
            value={tax}
            onChange={(event) => setTax(event.target.value)}
            disabled={submitting}
          />
        </FormField>
        <FormField label="New discount" htmlFor="adjustment_discount" required>
          <Input
            id="adjustment_discount"
            type="number"
            min={0}
            step="0.01"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
            disabled={submitting}
          />
        </FormField>
        <FormField label="Reason" htmlFor="adjustment_reason" required>
          <Textarea
            id="adjustment_reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Corrected line-item pricing after client review"
            disabled={submitting}
          />
        </FormField>
      </div>

      <div className="mt-4 rounded-md border border-border bg-text/[0.03] p-3 text-xs">
        <PreviewRow label="Current total" value={formatMoney(invoice.total_minor, invoice.currency)} />
        <PreviewRow
          label="New total"
          value={newTotalMinor === null ? "—" : formatMoney(newTotalMinor, invoice.currency)}
        />
        <PreviewRow
          label="Change"
          value={
            deltaMinor === null
              ? "—"
              : `${deltaMinor > 0 ? "+" : ""}${formatMoney(deltaMinor, invoice.currency)}`
          }
        />
        <PreviewRow label="Already settled" value={formatMoney(invoice.paid_minor, invoice.currency)} />
        <PreviewRow label="Current outstanding balance" value={formatMoney(invoice.balance_minor, invoice.currency)} />
        <PreviewRow
          label="New outstanding balance"
          value={newBalanceMinor === null ? "—" : formatMoney(newBalanceMinor, invoice.currency)}
        />
      </div>

      {wouldUnderpaySettled && newTotalMinor !== null ? (
        <p role="alert" className="mt-3 text-xs text-danger">
          This adjustment would reduce the invoice below the amount already paid or applied. Refund or resolve the
          settled amount first, or choose a corrected total of at least {formatMoney(invoice.paid_minor, invoice.currency)}.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleConfirm} disabled={!canSubmit}>
          {submitting ? "Adjusting…" : "Adjust Invoice"}
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
