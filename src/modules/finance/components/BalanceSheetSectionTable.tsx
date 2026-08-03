import { MoneyCell } from "@/modules/finance/components/MoneyCell";
import type { BalanceSheetSection } from "@/types/financeReport";

const CURRENT_PERIOD_EARNINGS_ACCOUNT_ID = "current-period-earnings";

interface BalanceSheetSectionTableProps {
  section: BalanceSheetSection;
}

/** Renders exactly the rows the Repository returned — never invents or recomputes a balance. The synthetic Current Period Earnings row is visually distinguished and never presented as a real Chart of Accounts entry. */
export function BalanceSheetSectionTable({ section }: BalanceSheetSectionTableProps) {
  return (
    <div>
      <h4 className="font-serif text-sm font-semibold text-text">{section.label}</h4>
      <div className="mt-2 hidden overflow-x-auto rounded-md border border-border md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {["Number", "Name", "Amount"].map((heading) => (
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
            {section.rows.map((row) => {
              const isSynthetic = row.accountId === CURRENT_PERIOD_EARNINGS_ACCOUNT_ID;
              return (
                <tr key={row.accountId} className={isSynthetic ? "bg-text/4 hover:bg-text/7" : "hover:bg-text/4"}>
                  <td className="border-b border-border px-2.5 py-2 whitespace-nowrap font-medium text-text">
                    {isSynthetic ? "—" : row.accountNumber}
                  </td>
                  <td className="border-b border-border px-2.5 py-2 text-text">
                    <span className="whitespace-nowrap">
                      {row.accountName}
                      {isSynthetic ? <span className="ml-1.5 text-xs text-text-muted">(report-only)</span> : null}
                    </span>
                    {isSynthetic ? (
                      <p className="mt-0.5 text-xs font-normal text-text-muted">
                        Not a real Chart of Accounts entry — represents net income not yet closed to Retained Earnings.
                      </p>
                    ) : null}
                  </td>
                  <td className="border-b border-border px-2.5 py-2 whitespace-nowrap font-medium">
                    <MoneyCell amountMinor={row.closingBalanceMinor} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-2.5 py-2 text-xs font-semibold tracking-wide text-text-muted uppercase" colSpan={2}>
                Total {section.label}
              </td>
              <td className="px-2.5 py-2 font-semibold whitespace-nowrap">
                <MoneyCell amountMinor={section.totalMinor} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-2 space-y-2 md:hidden">
        {section.rows.map((row) => {
          const isSynthetic = row.accountId === CURRENT_PERIOD_EARNINGS_ACCOUNT_ID;
          return (
            <div key={row.accountId} className={`rounded-md border border-border p-3 ${isSynthetic ? "bg-text/4" : ""}`}>
              <p className="text-sm font-medium text-text">
                {isSynthetic ? row.accountName : `${row.accountNumber} — ${row.accountName}`}
              </p>
              {isSynthetic ? (
                <p className="mt-0.5 text-xs text-text-muted">
                  Report-only — net income not yet closed to Retained Earnings.
                </p>
              ) : null}
              <p className="mt-1 text-sm">
                <MoneyCell amountMinor={row.closingBalanceMinor} />
              </p>
            </div>
          );
        })}
        <div className="flex items-center justify-between rounded-md border border-border p-3 text-sm font-semibold">
          <span>Total {section.label}</span>
          <MoneyCell amountMinor={section.totalMinor} />
        </div>
      </div>
    </div>
  );
}
