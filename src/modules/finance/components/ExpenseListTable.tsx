import Link from "next/link";
import { ExpenseStatusBadge } from "@/modules/finance/components/ExpenseStatusBadge";
import { ExpenseCategoryBadge } from "@/modules/finance/components/ExpenseCategoryBadge";
import { formatMoney } from "@/lib/money";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { ExpenseListRow } from "@/modules/finance/components/ExpensesListView";

export function ExpenseListTable({ rows }: { rows: ExpenseListRow[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-luxury-sm md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-[var(--z-index-dropdown)] bg-surface">
          <tr className="border-b border-border/70">
            {[
              "Date",
              "Description",
              "Category",
              "Event",
              "Status",
              "Amount",
              "Due date",
              "Reimbursable",
              "Reference",
              "Next action",
            ].map((heading) => (
              <th
                key={heading}
                className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase whitespace-nowrap"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map(({ expense, event, nextAction }) => (
            <tr key={expense.id} className="transition-colors duration-150 hover:bg-accent-100/25">
              <td className="px-5 py-4 whitespace-nowrap">
                <Link href={`/finance/expenses/${expense.id}`} className="font-medium text-text hover:text-accent">
                  {formatEventDate(expense.transaction_date)}
                </Link>
              </td>
              <td className="px-5 py-4 text-text-muted">{expense.description}</td>
              <td className="px-5 py-4">
                <ExpenseCategoryBadge category={expense.category} />
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {event ? event.title : "—"}
              </td>
              <td className="px-5 py-4">
                <ExpenseStatusBadge status={expense.status} />
              </td>
              <td className="px-5 py-4 whitespace-nowrap font-medium text-text">
                {formatMoney(expense.amount_minor, expense.currency)}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {formatEventDate(expense.due_date)}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {expense.reimbursable ? "Yes" : "No"}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {expense.reference ?? "—"}
              </td>
              <td className="px-5 py-4 text-text-muted">{nextAction ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
