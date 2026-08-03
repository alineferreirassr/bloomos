import { MoneyCell } from "@/modules/finance/components/MoneyCell";
import { VarianceCell } from "@/modules/finance/components/VarianceCell";
import type { ProfitAndLossSection } from "@/types/financeReport";

interface ProfitAndLossSectionTableProps {
  section: ProfitAndLossSection;
  hasComparison: boolean;
  /** Rollup sections (Gross Profit / Operating Income / Net Income) carry no rows of their own — only a computed total — and render as a single emphasized line rather than a table. */
  emphasized?: boolean;
}

/** Renders exactly the section the Repository returned — never invents a row, never recomputes a subtotal. */
export function ProfitAndLossSectionTable({ section, hasComparison, emphasized = false }: ProfitAndLossSectionTableProps) {
  if (emphasized) {
    return (
      <div className={`rounded-md border px-3.5 py-3 ${section.kind === "net_income" ? "border-accent/40 bg-accent/5" : "border-border bg-text/4"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`font-serif text-base font-semibold ${section.kind === "net_income" ? "text-accent" : "text-text"}`}>
            {section.label}
          </span>
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold">
              <MoneyCell amountMinor={section.totalCurrentPeriodMinor} />
            </span>
            {hasComparison ? <VarianceCell varianceMinor={section.totalVarianceMinor} /> : null}
          </div>
        </div>
        {hasComparison ? (
          <p className="mt-1 text-xs text-text-muted">
            Comparison:{" "}
            {section.totalComparisonPeriodMinor !== null ? <MoneyCell amountMinor={section.totalComparisonPeriodMinor} /> : "—"}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <h4 className="font-serif text-sm font-semibold text-text">{section.label}</h4>
      <div className="mt-2 hidden overflow-x-auto rounded-md border border-border md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {["Number", "Name", "Current Period", ...(hasComparison ? ["Comparison Period", "Variance"] : [])].map(
                (heading) => (
                  <th
                    key={heading}
                    className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase whitespace-nowrap"
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr key={row.accountId} className="hover:bg-text/4">
                <td className="border-b border-border px-2.5 py-2 whitespace-nowrap font-medium text-text">{row.accountNumber}</td>
                <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text">{row.accountName}</td>
                <td className="border-b border-border px-2.5 py-2 whitespace-nowrap">
                  <MoneyCell amountMinor={row.currentPeriodMinor} />
                </td>
                {hasComparison ? (
                  <>
                    <td className="border-b border-border px-2.5 py-2 whitespace-nowrap">
                      {row.comparisonPeriodMinor !== null ? <MoneyCell amountMinor={row.comparisonPeriodMinor} /> : "—"}
                    </td>
                    <td className="border-b border-border px-2.5 py-2 whitespace-nowrap">
                      <VarianceCell varianceMinor={row.varianceMinor} />
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-2.5 py-2 text-xs font-semibold tracking-wide text-text-muted uppercase" colSpan={2}>
                Total {section.label}
              </td>
              <td className="px-2.5 py-2 font-semibold whitespace-nowrap">
                <MoneyCell amountMinor={section.totalCurrentPeriodMinor} />
              </td>
              {hasComparison ? (
                <>
                  <td className="px-2.5 py-2 font-semibold whitespace-nowrap">
                    {section.totalComparisonPeriodMinor !== null ? <MoneyCell amountMinor={section.totalComparisonPeriodMinor} /> : "—"}
                  </td>
                  <td className="px-2.5 py-2 font-semibold whitespace-nowrap">
                    <VarianceCell varianceMinor={section.totalVarianceMinor} />
                  </td>
                </>
              ) : null}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-2 space-y-2 md:hidden">
        {section.rows.map((row) => (
          <div key={row.accountId} className="rounded-md border border-border p-3">
            <p className="text-sm font-medium text-text">
              {row.accountNumber} — {row.accountName}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-text-muted">
                Current: <MoneyCell amountMinor={row.currentPeriodMinor} />
              </span>
              {hasComparison ? (
                <>
                  <span className="text-text-muted">
                    Comparison: {row.comparisonPeriodMinor !== null ? <MoneyCell amountMinor={row.comparisonPeriodMinor} /> : "—"}
                  </span>
                  <span className="text-text-muted">
                    Variance: <VarianceCell varianceMinor={row.varianceMinor} />
                  </span>
                </>
              ) : null}
            </div>
          </div>
        ))}
        <div className="rounded-md border border-border p-3 text-sm font-semibold">
          <div className="flex items-center justify-between">
            <span>Total {section.label}</span>
            <MoneyCell amountMinor={section.totalCurrentPeriodMinor} />
          </div>
          {hasComparison ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-normal text-text-muted">
              <span>
                Comparison:{" "}
                {section.totalComparisonPeriodMinor !== null ? (
                  <MoneyCell amountMinor={section.totalComparisonPeriodMinor} />
                ) : (
                  "—"
                )}
              </span>
              <span>
                Variance: <VarianceCell varianceMinor={section.totalVarianceMinor} />
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
