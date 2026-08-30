import Link from "next/link";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { formatMoney } from "@/lib/money";
import type { FinancialSummaryView } from "@/modules/finance/financeActions";

interface ClientFinancialSummaryCardProps {
  clientId: string;
  summary: FinancialSummaryView;
  /** All-USD, same convention as EventFinancialSummaryCard until multi-currency Clients exist. */
  currency?: string;
}

/** `null` means the server redacted this figure for the current session's permissions (see `financeActions.ts`) — rendered as "—", never as $0.00. */
function money(minor: number | null, currency: string): string {
  return minor === null ? "—" : formatMoney(minor, currency);
}

/**
 * Read-only rollup on Client Detail — every figure comes straight from
 * `getClientFinancialSummaryAction` (`modules/finance/financeActions.ts`),
 * never recomputed here. Same stat layout as EventFinancialSummaryCard, scoped
 * to the Client across every one of their Events/standalone Contracts instead
 * of a single Event, so no per-Event status badge (financial status is a
 * per-Event concept, not a per-Client one). Individual fields may be `null`
 * — the caller's session held `finance.view` (or the card wouldn't render at
 * all — see `ClientDetailView.tsx`) but lacked `finance.amounts.view`/
 * `finance.executive.view` for that specific figure.
 */
export function ClientFinancialSummaryCard({ clientId, summary, currency = "USD" }: ClientFinancialSummaryCardProps) {
  return (
    <LuxuryCard>
      <h3 className="font-serif text-[17px] font-semibold text-text">Finance</h3>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <PrimaryStat label="Contracted" value={money(summary.contracted_value_minor, currency)} />
        <PrimaryStat label="Invoiced" value={money(summary.invoiced_total_minor, currency)} />
        <PrimaryStat label="Collected" value={money(summary.collected_minor, currency)} />
        <PrimaryStat label="Outstanding" value={money(summary.outstanding_minor, currency)} />
      </dl>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
        <Stat label="Refunded" value={money(summary.refunded_minor, currency)} />
        <Stat label="Expenses" value={money(summary.expense_total_minor, currency)} />
        <Stat label="Gross profit" value={money(summary.gross_profit_minor, currency)} />
        <Stat label="Net profit" value={money(summary.net_profit_minor, currency)} />
        <Stat label="Deposit required" value={money(summary.deposit_required_minor, currency)} />
        <Stat label="Deposit paid" value={money(summary.deposit_paid_minor, currency)} />
        <Stat label="Deposit balance" value={money(summary.deposit_balance_minor, currency)} />
        <Stat
          label="Payment completion"
          value={summary.payment_completion_percentage === null ? "—" : `${summary.payment_completion_percentage}%`}
        />
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/finance/invoices/new?clientId=${clientId}`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text hover:border-accent/50"
        >
          Create Invoice
        </Link>
        <Link
          href="/finance/invoices"
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text hover:border-accent/50"
        >
          View Invoices
        </Link>
      </div>
    </LuxuryCard>
  );
}

function PrimaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 font-serif text-xl font-semibold text-text">{value}</dd>
    </div>
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
