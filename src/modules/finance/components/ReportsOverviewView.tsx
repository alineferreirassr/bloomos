import Link from "next/link";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Button } from "@/components/ui/Button";
import { FinanceReportsNav } from "@/modules/finance/components/FinanceReportsNav";

const REPORT_CARDS = [
  {
    href: "/finance/reports/general-ledger",
    name: "General Ledger",
    purpose: "Every posted transaction for each account, with a running balance across a date range.",
    dateModel: "Date range",
  },
  {
    href: "/finance/reports/trial-balance",
    name: "Trial Balance",
    purpose: "Every account's ending debit or credit balance as of one date, confirming the ledger balances.",
    dateModel: "As-of date",
  },
  {
    href: "/finance/reports/profit-and-loss",
    name: "Profit and Loss",
    purpose: "Revenue and expense activity for a date range, rolling up to Net Income.",
    dateModel: "Date range",
  },
  {
    href: "/finance/reports/balance-sheet",
    name: "Balance Sheet",
    purpose: "Assets, Liabilities, and Equity as of one date, confirming Assets equal Liabilities plus Equity.",
    dateModel: "As-of date",
  },
] as const;

/**
 * Pure navigation and explanation — no report is fetched or calculated on
 * this page. Each card links straight to its report page, which owns its
 * own filters and Repository call.
 */
export function ReportsOverviewView() {
  return (
    <div>
      <div>
        <h2 className="font-serif text-3xl font-semibold text-text">Finance Reports</h2>
        <p className="mt-1 text-sm text-text-muted">
          Statements derived directly from the ledger — Journal Entries, Journal Lines, and the Chart of Accounts.
        </p>
      </div>

      <div className="mt-6">
        <FinanceReportsNav />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {REPORT_CARDS.map((report) => (
          <LuxuryCard key={report.href}>
            <h3 className="font-serif text-[17px] font-semibold text-text">{report.name}</h3>
            <p className="mt-1.5 text-sm text-text-muted">{report.purpose}</p>
            <p className="mt-2 text-xs text-text-muted uppercase tracking-wide">{report.dateModel}</p>
            <div className="mt-4">
              <Link href={report.href}>
                <Button variant="secondary">Open {report.name}</Button>
              </Link>
            </div>
          </LuxuryCard>
        ))}
      </div>

      <div className="mt-6 rounded-md border border-border bg-text/4 px-4 py-3 text-sm text-text-muted">
        Cash Flow, Accounts Receivable Aging, and Accounts Payable Aging are planned but not yet available — the
        underlying ledger data needed to report them accurately doesn&apos;t exist yet.
      </div>
    </div>
  );
}
