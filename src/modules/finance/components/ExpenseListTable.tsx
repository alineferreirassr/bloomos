import Link from "next/link";
import { ExpenseStatusBadge } from "@/modules/finance/components/ExpenseStatusBadge";
import { ExpenseCategoryBadge } from "@/modules/finance/components/ExpenseCategoryBadge";
import { formatMoney } from "@/lib/money";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { ExpenseListRow } from "@/modules/finance/components/ExpensesListView";

export function ExpenseListTable({ rows }: { rows: ExpenseListRow[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-md border border-border md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
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
                className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase whitespace-nowrap"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ expense, event, nextAction }) => (
            <tr key={expense.id} className="hover:bg-text/4">
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap">
                <Link href={`/finance/expenses/${expense.id}`} className="font-medium text-text hover:text-accent">
                  {formatEventDate(expense.transaction_date)}
                </Link>
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{expense.description}</td>
              <td className="border-b border-border px-2.5 py-2">
                <ExpenseCategoryBadge category={expense.category} />
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {event ? event.title : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <ExpenseStatusBadge status={expense.status} />
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap font-medium text-text">
                {formatMoney(expense.amount_minor, expense.currency)}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {formatEventDate(expense.due_date)}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {expense.reimbursable ? "Yes" : "No"}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {expense.reference ?? "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{nextAction ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
