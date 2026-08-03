"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/money";
import {
  getClientPortalInvoiceDocumentAction,
  compareClientPortalInvoiceVersionsAction,
  type ClientPortalInvoiceDocumentSummary,
} from "@/modules/clientPortal/getClientPortalInvoiceDocument";
import type { InvoiceComparisonResult } from "@/types/invoicePlatform";
import { INVOICE_LINE_ITEM_KIND_LABELS, INVOICE_ADJUSTMENT_KIND_LABELS, INVOICE_INSTALLMENT_KINDS } from "@/types/invoicePlatform";

/**
 * v2.0 Checkpoint 35, Step 14 — additive, read-only "Invoice Document" card
 * on the Client Portal's Invoice Detail page. No payments, no PDF button —
 * the real Stripe-backed payment flow and PDF download above this card
 * (Checkpoint 23) are untouched and stay the only path that moves money.
 */
export function ClientPortalInvoiceDocumentSection({ invoiceId }: { invoiceId: string }) {
  const [summary, setSummary] = useState<ClientPortalInvoiceDocumentSummary | null | "loading">("loading");
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);
  const [comparison, setComparison] = useState<InvoiceComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    getClientPortalInvoiceDocumentAction(invoiceId).then((result) => setSummary(result.success ? result.data : null));
  }, [invoiceId]);

  if (summary === "loading") return null;
  if (summary === null) return null;

  const handleCompare = async () => {
    if (compareA === null || compareB === null) return;
    setComparing(true);
    const result = await compareClientPortalInvoiceVersionsAction(invoiceId, compareA, compareB);
    setComparing(false);
    if (result.success) setComparison(result.data);
  };

  const { pricing } = summary;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-[17px] font-semibold text-text">Invoice Document</h3>
        <Badge tone="neutral">v{summary.currentVersionNumber}</Badge>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-text">Line Items</h4>
          {summary.lineItems.length === 0 ? (
            <p className="mt-1 text-sm text-text-muted">No line items yet.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {summary.lineItems.map((li) => (
                <li key={li.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {li.label} <span className="text-text-muted">({INVOICE_LINE_ITEM_KIND_LABELS[li.kind]})</span>
                  </span>
                  <span className="text-text-muted">{formatMoney(li.amount_minor, pricing.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-text">Payment Schedule</h4>
          {summary.paymentSchedule.length === 0 ? (
            <p className="mt-1 text-sm text-text-muted">No payment schedule has been set yet.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {summary.paymentSchedule.map((inst) => (
                <li key={inst.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {inst.label} <span className="text-text-muted">({INVOICE_INSTALLMENT_KINDS.includes(inst.kind) ? inst.kind.replace(/_/g, " ") : inst.kind})</span>
                    {inst.dueDate ? <span className="text-text-muted"> · due {new Date(inst.dueDate).toLocaleDateString()}</span> : null}
                  </span>
                  <span className="text-text-muted">{formatMoney(inst.amount_minor, pricing.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {summary.adjustments.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold text-text">Credits &amp; Adjustments</h4>
            <ul className="mt-1 space-y-1">
              {summary.adjustments.map((adj) => (
                <li key={adj.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {adj.label} <span className="text-text-muted">({INVOICE_ADJUSTMENT_KIND_LABELS[adj.kind]})</span>
                  </span>
                  <span className="text-text-muted">{formatMoney(adj.amount_minor, pricing.currency)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <dl className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <Field label="Deposit due" value={formatMoney(pricing.depositDue_minor, pricing.currency)} />
          <Field label="Remaining balance" value={formatMoney(pricing.remainingBalance_minor, pricing.currency)} />
          <Field label="Grand total" value={formatMoney(pricing.grandTotal_minor, pricing.currency)} />
          <Field label="Outstanding balance" value={formatMoney(pricing.outstandingBalance_minor, pricing.currency)} />
        </dl>

        {summary.terms ? (
          <div>
            <h4 className="text-sm font-semibold text-text">Terms</h4>
            <p className="mt-1 text-sm text-text-muted">{summary.terms}</p>
          </div>
        ) : null}

        {summary.policies ? (
          <div>
            <h4 className="text-sm font-semibold text-text">Policies</h4>
            <p className="mt-1 text-sm text-text-muted">{summary.policies}</p>
          </div>
        ) : null}

        {summary.availableVersionNumbers.length > 1 ? (
          <div>
            <h4 className="text-sm font-semibold text-text">Compare Versions</h4>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Select value={compareA ?? ""} onChange={(e) => setCompareA(e.target.value ? Number(e.target.value) : null)} className="max-w-[8rem]">
                <option value="">—</option>
                {summary.availableVersionNumbers.map((n) => (
                  <option key={n} value={n}>
                    v{n}
                  </option>
                ))}
              </Select>
              <Select value={compareB ?? ""} onChange={(e) => setCompareB(e.target.value ? Number(e.target.value) : null)} className="max-w-[8rem]">
                <option value="">—</option>
                {summary.availableVersionNumbers.map((n) => (
                  <option key={n} value={n}>
                    v{n}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" onClick={handleCompare} disabled={compareA === null || compareB === null || comparing}>
                {comparing ? "Comparing…" : "Compare"}
              </Button>
            </div>
            {comparison ? (
              <ul className="mt-2 space-y-1 text-xs text-text-muted">
                {comparison.diffs.map((d, i) => (
                  <li key={i}>
                    [{d.category}] {d.field}: {d.changeType}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value}</dd>
    </div>
  );
}
