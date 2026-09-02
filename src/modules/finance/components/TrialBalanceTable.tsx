import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge } from "@/components/ui/Badge";
import { AccountTypeBadge } from "@/modules/finance/components/AccountTypeBadge";
import { MoneyCell } from "@/modules/finance/components/MoneyCell";
import type { TrialBalanceRow } from "@/types/financeReport";

interface TrialBalanceTableProps {
  rows: TrialBalanceRow[];
  totalEndingDebitMinor: number;
  totalEndingCreditMinor: number;
}

/** Every account is shown regardless of archived status — archived accounts with historical activity are never hidden. */
export function TrialBalanceTable({ rows, totalEndingDebitMinor, totalEndingCreditMinor }: TrialBalanceTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-luxury-sm md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/70">
              {["Number", "Name", "Type", "Debit Activity", "Credit Activity", "Ending Debit", "Ending Credit"].map(
                (heading) => (
                  <th
                    key={heading}
                    className="px-5 py-4 text-[11px] tracking-wide text-text-muted uppercase whitespace-nowrap"
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => (
              <tr key={row.accountId} className="hover:bg-text/4">
                <td className="px-5 py-4 whitespace-nowrap font-medium text-text">
                  {row.accountNumber}
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-text">
                  {row.accountName}
                  {row.isArchived ? (
                    <Badge tone="neutral" className="ml-2">
                      Inactive
                    </Badge>
                  ) : null}
                </td>
                <td className="px-5 py-4">
                  <AccountTypeBadge accountType={row.accountType} />
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <MoneyCell amountMinor={row.debitMinor} hideZero />
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <MoneyCell amountMinor={row.creditMinor} hideZero />
                </td>
                <td className="px-5 py-4 whitespace-nowrap font-medium">
                  <MoneyCell amountMinor={row.endingDebitMinor} hideZero />
                </td>
                <td className="px-5 py-4 whitespace-nowrap font-medium">
                  <MoneyCell amountMinor={row.endingCreditMinor} hideZero />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-5 py-4 text-xs font-semibold tracking-wide text-text-muted uppercase" colSpan={5}>
                Total
              </td>
              <td className="px-5 py-4 font-semibold whitespace-nowrap">
                <MoneyCell amountMinor={totalEndingDebitMinor} />
              </td>
              <td className="px-5 py-4 font-semibold whitespace-nowrap">
                <MoneyCell amountMinor={totalEndingCreditMinor} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <LuxuryCard key={row.accountId}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium tracking-tight text-text">
                  {row.accountNumber} — {row.accountName}
                </p>
                {row.isArchived ? <Badge tone="neutral">Inactive</Badge> : null}
              </div>
              <AccountTypeBadge accountType={row.accountType} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-text-muted">
                Debit activity: <MoneyCell amountMinor={row.debitMinor} hideZero />
              </span>
              <span className="text-text-muted">
                Credit activity: <MoneyCell amountMinor={row.creditMinor} hideZero />
              </span>
              <span className="text-text-muted">
                Ending debit: <span className="font-medium text-text"><MoneyCell amountMinor={row.endingDebitMinor} hideZero /></span>
              </span>
              <span className="text-text-muted">
                Ending credit: <span className="font-medium text-text"><MoneyCell amountMinor={row.endingCreditMinor} hideZero /></span>
              </span>
            </div>
          </LuxuryCard>
        ))}
        <LuxuryCard className="flex items-center justify-between text-sm font-semibold">
          <span>Total</span>
          <span>
            <MoneyCell amountMinor={totalEndingDebitMinor} /> / <MoneyCell amountMinor={totalEndingCreditMinor} />
          </span>
        </LuxuryCard>
      </div>
    </>
  );
}
