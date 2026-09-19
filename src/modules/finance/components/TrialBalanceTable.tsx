import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
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
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <tr>
              {["Number", "Name", "Type", "Debit Activity", "Credit Activity", "Ending Debit", "Ending Credit"].map(
                (heading) => (
                  <TableHeaderCell key={heading} className="whitespace-nowrap">
                    {heading}
                  </TableHeaderCell>
                ),
              )}
            </tr>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.accountId}>
                <TableCell className="whitespace-nowrap font-medium text-text">
                  {row.accountNumber}
                </TableCell>
                <TableCell className="whitespace-nowrap text-text">
                  {row.accountName}
                  {row.isArchived ? (
                    <Badge tone="neutral" className="ml-2">
                      Inactive
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>
                  <AccountTypeBadge accountType={row.accountType} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <MoneyCell amountMinor={row.debitMinor} hideZero />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <MoneyCell amountMinor={row.creditMinor} hideZero />
                </TableCell>
                <TableCell className="whitespace-nowrap font-medium">
                  <MoneyCell amountMinor={row.endingDebitMinor} hideZero />
                </TableCell>
                <TableCell className="whitespace-nowrap font-medium">
                  <MoneyCell amountMinor={row.endingCreditMinor} hideZero />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <tfoot>
            <tr className="border-t border-border/70">
              <td className="px-4 py-3 text-xs font-semibold tracking-wide text-text-muted uppercase" colSpan={5}>
                Total
              </td>
              <td className="px-4 py-3 font-semibold whitespace-nowrap">
                <MoneyCell amountMinor={totalEndingDebitMinor} />
              </td>
              <td className="px-4 py-3 font-semibold whitespace-nowrap">
                <MoneyCell amountMinor={totalEndingCreditMinor} />
              </td>
            </tr>
          </tfoot>
        </Table>
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
