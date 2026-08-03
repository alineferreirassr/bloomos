import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/money";
import type { JournalLine } from "@/types/journalEntry";

/** account enrichment (account_number/name/account_type) comes from getJournalEntry's own batched join — never refetched per line here. */
export function JournalLinesTable({ lines, currency }: { lines: JournalLine[]; currency: string }) {
  const totalDebitMinor = lines.reduce((sum, line) => sum + line.debit_minor, 0);
  const totalCreditMinor = lines.reduce((sum, line) => sum + line.credit_minor, 0);

  return (
    <>
      <div className="hidden overflow-x-auto rounded-md border border-border md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {["Account", "Description", "Debit", "Credit"].map((heading) => (
                <th
                  key={heading}
                  className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase whitespace-nowrap"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="hover:bg-text/4">
                <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text">
                  {line.account ? `${line.account.account_number} — ${line.account.name}` : "—"}
                </td>
                <td className="border-b border-border px-2.5 py-2 text-text-muted">{line.line_memo ?? "—"}</td>
                <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text">
                  {line.debit_minor > 0 ? formatMoney(line.debit_minor, currency) : "—"}
                </td>
                <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text">
                  {line.credit_minor > 0 ? formatMoney(line.credit_minor, currency) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-2.5 py-2 text-xs font-semibold tracking-wide text-text-muted uppercase" colSpan={2}>
                Total
              </td>
              <td className="px-2.5 py-2 font-semibold whitespace-nowrap text-text">
                {formatMoney(totalDebitMinor, currency)}
              </td>
              <td className="px-2.5 py-2 font-semibold whitespace-nowrap text-text">
                {formatMoney(totalCreditMinor, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {lines.map((line) => (
          <Card key={line.id}>
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
          </Card>
        ))}
        <Card className="flex items-center justify-between text-sm font-semibold">
          <span>Total</span>
          <span>
            {formatMoney(totalDebitMinor, currency)} / {formatMoney(totalCreditMinor, currency)}
          </span>
        </Card>
      </div>
    </>
  );
}
