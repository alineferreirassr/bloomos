import Link from "next/link";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { formatMoney } from "@/lib/money";
import type { FinancialSummaryView } from "@/modules/finance/financeActions";
import type { EventFinancialStatus } from "@/modules/finance/eventFinancialStatus";
import { EventFinancialStatusBadge } from "@/modules/finance/components/EventFinancialStatusBadge";

interface EventFinancialSummaryCardProps {
  eventId: string;
  clientId: string;
  summary: FinancialSummaryView;
  status: EventFinancialStatus;
  /** All-USD, same convention as the rest of the Finance module until multi-currency Events exist. */
  currency?: string;
}

/** `null` means the server redacted this figure for the current session's permissions (see `financeActions.ts`) — rendered as "—", never as $0.00. */
function money(minor: number | null, currency: string): string {
  return minor === null ? "—" : formatMoney(minor, currency);
}

/**
 * Read-only rollup on Event Detail — every figure comes straight from
 * `getEventFinancialSummaryAction` (`modules/finance/financeActions.ts`),
 * never recomputed here. "Create Invoice" passes both eventId and clientId —
 * the Invoice form's Event dropdown only populates once a Client is
 * selected, so eventId alone wouldn't visibly prefill anything. Individual
 * fields may be `null` — the caller's session held `finance.view` (or the
 * card wouldn't render at all — see `EventDetailView.tsx`) but lacked
 * `finance.amounts.view`/`finance.executive.view` for that specific figure.
 */
export function EventFinancialSummaryCard({
  eventId,
  clientId,
  summary,
  status,
  currency = "USD",
}: EventFinancialSummaryCardProps) {
  return (
    <LuxuryCard>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[17px] font-semibold text-text">Finance</h3>
        <EventFinancialStatusBadge status={status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Contracted value" value={money(summary.contracted_value_minor, currency)} />
        <Stat label="Invoiced" value={money(summary.invoiced_total_minor, currency)} />
        <Stat label="Collected" value={money(summary.collected_minor, currency)} />
        <Stat label="Refunded" value={money(summary.refunded_minor, currency)} />
        <Stat label="Outstanding" value={money(summary.outstanding_minor, currency)} />
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
          href={`/finance/invoices/new?eventId=${eventId}&clientId=${clientId}`}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text">{value}</dd>
    </div>
  );
}
