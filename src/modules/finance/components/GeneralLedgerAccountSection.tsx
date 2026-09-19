import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { AccountTypeBadge } from "@/modules/finance/components/AccountTypeBadge";
import { MoneyCell } from "@/modules/finance/components/MoneyCell";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { GeneralLedgerAccount } from "@/types/financeReport";

interface GeneralLedgerAccountSectionProps {
  account: GeneralLedgerAccount;
}

/**
 * One account's slice of the General Ledger — every value shown (opening,
 * per-line debit/credit, running balance, closing) comes straight from the
 * Repository's own GeneralLedgerAccount; nothing here recomputes a running
 * balance or a total.
 */
export function GeneralLedgerAccountSection({ account }: GeneralLedgerAccountSectionProps) {
  const totalDebitMinor = account.transactions.reduce((sum, t) => sum + t.debitMinor, 0);
  const totalCreditMinor = account.transactions.reduce((sum, t) => sum + t.creditMinor, 0);

  return (
    <LuxuryCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium tracking-tight text-text">
            {account.accountNumber} — {account.accountName}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <AccountTypeBadge accountType={account.accountType} />
            <span className="text-xs text-text-muted capitalize">Normal balance: {account.normalBalance}</span>
          </div>
        </div>
        <div className="text-right text-xs text-text-muted">
          <p>
            Opening balance: <MoneyCell amountMinor={account.openingBalanceMinor} />
          </p>
          <p className="mt-0.5">
            Closing balance: <span className="font-medium"><MoneyCell amountMinor={account.closingBalanceMinor} /></span>
          </p>
        </div>
      </div>

      {account.transactions.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">No activity in the selected range.</p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto rounded-lg border border-border/60 md:block">
            <table className="w-full border-collapse text-left text-sm">
              <TableHead>
                <tr>
                  {["Date", "Reference", "Memo / Description", "Source Type", "Debit", "Credit", "Running Balance"].map(
                    (heading) => (
                      <TableHeaderCell key={heading} className="whitespace-nowrap">
                        {heading}
                      </TableHeaderCell>
                    ),
                  )}
                </tr>
              </TableHead>
              <TableBody>
                {account.transactions.map((transaction) => (
                  <TableRow key={transaction.journalLineId}>
                    <TableCell className="whitespace-nowrap">
                      {formatEventDate(transaction.entryDate)}
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap text-text-muted">
                      {transaction.journalEntryId.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-text-muted">
                      {transaction.memo ?? transaction.lineMemo ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-text-muted">
                      <div>{transaction.sourceType}</div>
                      {transaction.sourceId ? (
                        <div className="font-mono text-[10px] text-text-muted/70">{transaction.sourceId.slice(0, 8)}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <MoneyCell amountMinor={transaction.debitMinor} hideZero />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <MoneyCell amountMinor={transaction.creditMinor} hideZero />
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      <MoneyCell amountMinor={transaction.runningBalanceMinor} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <tfoot>
                <tr className="border-t border-border/70">
                  <td className="px-4 py-3 text-xs font-semibold tracking-wide text-text-muted uppercase" colSpan={4}>
                    Total movement
                  </td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    <MoneyCell amountMinor={totalDebitMinor} />
                  </td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    <MoneyCell amountMinor={totalCreditMinor} />
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-4 space-y-3 md:hidden">
            {account.transactions.map((transaction) => (
              <div key={transaction.journalLineId} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text">{formatEventDate(transaction.entryDate)}</p>
                    {transaction.memo ?? transaction.lineMemo ? (
                      <p className="mt-0.5 truncate text-xs text-text-muted">{transaction.memo ?? transaction.lineMemo}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-right text-[11px] text-text-muted">
                    <span className="sr-only">Journal Entry </span>
                    <span className="font-mono">{transaction.journalEntryId.slice(0, 8)}</span>
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-text-muted">
                  Source: {transaction.sourceType}
                  {transaction.sourceId ? ` · ${transaction.sourceId.slice(0, 8)}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span className="text-text-muted">
                    Debit: <MoneyCell amountMinor={transaction.debitMinor} hideZero />
                  </span>
                  <span className="text-text-muted">
                    Credit: <MoneyCell amountMinor={transaction.creditMinor} hideZero />
                  </span>
                  <span className="text-text-muted">
                    Running balance: <MoneyCell amountMinor={transaction.runningBalanceMinor} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </LuxuryCard>
  );
}
