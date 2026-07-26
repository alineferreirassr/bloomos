import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/money";
import type { ClientFinancialSummary } from "@/modules/finance/financialSummary";

interface ClientFinancialSummaryCardProps {
  clientId: string;
  summary: ClientFinancialSummary;
  /** All-USD, same convention as EventFinancialSummaryCard until multi-currency Clients exist. */
  currency?: string;
}

/**
 * Read-only rollup on Client Detail — every figure comes straight from
 * computeClientFinancialSummary (lib/data/index.ts's getClientFinancialSummary),
 * never recomputed here. Same stat layout as EventFinancialSummaryCard, scoped
 * to the Client across every one of their Events/standalone Contracts instead
 * of a single Event, so no per-Event status badge (financial status is a
 * per-Event concept, not a per-Client one).
 */
export function ClientFinancialSummaryCard({ clientId, summary, currency = "USD" }: ClientFinancialSummaryCardProps) {
  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Finance</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Contracted value" value={formatMoney(summary.contracted_value_minor, currency)} />
        <Stat label="Invoiced" value={formatMoney(summary.invoiced_total_minor, currency)} />
        <Stat label="Collected" value={formatMoney(summary.collected_minor, currency)} />
        <Stat label="Refunded" value={formatMoney(summary.refunded_minor, currency)} />
        <Stat label="Outstanding" value={formatMoney(summary.outstanding_minor, currency)} />
        <Stat label="Expenses" value={formatMoney(summary.expense_total_minor, currency)} />
        <Stat label="Gross profit" value={formatMoney(summary.gross_profit_minor, currency)} />
        <Stat label="Net profit" value={formatMoney(summary.net_profit_minor, currency)} />
        <Stat label="Deposit required" value={formatMoney(summary.deposit_required_minor, currency)} />
        <Stat label="Deposit paid" value={formatMoney(summary.deposit_paid_minor, currency)} />
        <Stat label="Deposit balance" value={formatMoney(summary.deposit_balance_minor, currency)} />
        <Stat label="Payment completion" value={`${summary.payment_completion_percentage}%`} />
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
    </Card>
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
