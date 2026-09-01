import Link from "next/link";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/money";
import type { ContractDepositStatus } from "@/lib/data";
import type { ContractFinancialSummaryView } from "@/modules/finance/financeActions";
import { InvoiceStatusBadge } from "@/modules/finance/components/InvoiceStatusBadge";

function money(minor: number | null, currency: string): string {
  return minor === null ? "—" : formatMoney(minor, currency);
}

const DEPOSIT_STATUS_LABELS: Record<ContractDepositStatus, string> = {
  not_required: "Not required",
  awaiting_deposit: "Awaiting deposit",
  deposit_partial: "Deposit partially paid",
  deposit_paid: "Deposit paid",
};

const DEPOSIT_STATUS_TONES: Record<ContractDepositStatus, BadgeTone> = {
  not_required: "neutral",
  awaiting_deposit: "warning",
  deposit_partial: "warning",
  deposit_paid: "accent",
};

interface ContractFinanceSummaryCardProps {
  contractId: string;
  clientId: string;
  summary: ContractFinancialSummaryView;
  currency?: string;
}

/**
 * Small Finance rollup on Contract Detail — every figure comes straight
 * from getContractFinanceSummary() (lib/data/index.ts) via the server-side
 * getContractFinancialSummaryAction (financeActions.ts), which redacts
 * every monetary field to `null` (rendered here as "—") for a caller
 * lacking `finance.amounts.view`; never recomputed here. "Create Invoice"
 * carries both contractId and clientId so the new-Invoice form's Contract
 * dropdown (which only populates once a Client is selected) actually shows
 * this Contract preselected.
 */
export function ContractFinanceSummaryCard({ contractId, clientId, summary, currency = "USD" }: ContractFinanceSummaryCardProps) {
  return (
    <LuxuryCard>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[17px] font-semibold text-text">Finance</h3>
        <Badge tone={DEPOSIT_STATUS_TONES[summary.depositStatus]}>
          {DEPOSIT_STATUS_LABELS[summary.depositStatus]}
        </Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Total invoiced" value={money(summary.totalInvoicedMinor, currency)} />
        <Stat label="Total collected" value={money(summary.totalCollectedMinor, currency)} />
        <Stat label="Outstanding" value={money(summary.outstandingMinor, currency)} />
      </dl>

      {summary.invoices.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {summary.invoices.map((invoice) => (
            <li key={invoice.id}>
              <Link
                href={`/finance/invoices/${invoice.id}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs hover:border-accent/50"
              >
                <span className="truncate text-text">{invoice.invoice_number}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="text-text-muted">{money(invoice.total_minor, invoice.currency)}</span>
                  <InvoiceStatusBadge status={invoice.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-text-muted">No invoices linked to this contract yet.</p>
      )}

      <div className="mt-4">
        <Link
          href={`/finance/invoices/new?contractId=${contractId}&clientId=${clientId}`}
          className="inline-block rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text hover:border-accent/50"
        >
          Create Invoice
        </Link>
      </div>
    </LuxuryCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text">{value}</dd>
    </div>
  );
}
