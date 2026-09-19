import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { formatMoney } from "@/lib/money";
import type { JournalLine } from "@/types/journalEntry";

/** account enrichment (account_number/name/account_type) comes from getJournalEntry's own batched join — never refetched per line here. */
export function JournalLinesTable({ lines, currency }: { lines: JournalLine[]; currency: string }) {
  const totalDebitMinor = lines.reduce((sum, line) => sum + line.debit_minor, 0);
  const totalCreditMinor = lines.reduce((sum, line) => sum + line.credit_minor, 0);

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <tr>
              {["Account", "Description", "Debit", "Credit"].map((heading) => (
                <TableHeaderCell key={heading} className="whitespace-nowrap">
                  {heading}
                </TableHeaderCell>
              ))}
            </tr>
          </TableHead>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="whitespace-nowrap text-text">
                  {line.account ? `${line.account.account_number} — ${line.account.name}` : "—"}
                </TableCell>
                <TableCell className="text-text-muted">{line.line_memo ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-text">
                  {line.debit_minor > 0 ? formatMoney(line.debit_minor, currency) : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-text">
                  {line.credit_minor > 0 ? formatMoney(line.credit_minor, currency) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <tfoot>
            <tr className="border-t border-border/70">
              <td className="px-4 py-3 text-xs font-semibold tracking-wide text-text-muted uppercase" colSpan={2}>
                Total
              </td>
              <td className="px-4 py-3 font-semibold whitespace-nowrap text-text">
                {formatMoney(totalDebitMinor, currency)}
              </td>
              <td className="px-4 py-3 font-semibold whitespace-nowrap text-text">
                {formatMoney(totalCreditMinor, currency)}
              </td>
            </tr>
          </tfoot>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {lines.map((line) => (
          <LuxuryCard key={line.id}>
            <p className="text-sm font-medium text-text">
              {line.account ? `${line.account.account_number} — ${line.account.name}` : "—"}
            </p>
            {line.line_memo ? <p className="mt-0.5 text-xs text-text-muted">{line.line_memo}</p> : null}
            <div className="mt-2 flex gap-6 text-sm">
              <span className="text-text-muted">
                Debit: <span className="text-text">{line.debit_minor > 0 ? formatMoney(line.debit_minor, currency) : "—"}</span>
              </span>
              <span className="text-text-muted">
                Credit: <span className="text-text">{line.credit_minor > 0 ? formatMoney(line.credit_minor, currency) : "—"}</span>
              </span>
            </div>
          </LuxuryCard>
        ))}
        <LuxuryCard className="flex items-center justify-between text-sm font-semibold">
          <span>Total</span>
          <span>
            {formatMoney(totalDebitMinor, currency)} / {formatMoney(totalCreditMinor, currency)}
          </span>
        </LuxuryCard>
      </div>
    </>
  );
}
