import Link from "next/link";
import { ExpenseStatusBadge } from "@/modules/finance/components/ExpenseStatusBadge";
import { ExpenseCategoryBadge } from "@/modules/finance/components/ExpenseCategoryBadge";
import { formatMoney } from "@/lib/money";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { ExpenseListRow } from "@/modules/finance/components/ExpensesListView";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";

export function ExpenseListTable({ rows }: { rows: ExpenseListRow[] }) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHead>
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
              <TableHeaderCell key={heading} className="whitespace-nowrap">
                {heading}
              </TableHeaderCell>
            ))}
          </tr>
        </TableHead>
        <TableBody>
          {rows.map(({ expense, event, nextAction }) => (
            <TableRow key={expense.id}>
              <TableCell className="whitespace-nowrap">
                <Link href={`/finance/expenses/${expense.id}`} className="font-medium text-text hover:text-accent">
                  {formatEventDate(expense.transaction_date)}
                </Link>
              </TableCell>
              <TableCell className="text-text-muted">{expense.description}</TableCell>
              <TableCell>
                <ExpenseCategoryBadge category={expense.category} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {event ? event.title : "—"}
              </TableCell>
              <TableCell>
                <ExpenseStatusBadge status={expense.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap font-medium text-text">
                {formatMoney(expense.amount_minor, expense.currency)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {formatEventDate(expense.due_date)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {expense.reimbursable ? "Yes" : "No"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {expense.reference ?? "—"}
              </TableCell>
              <TableCell className="text-text-muted">{nextAction ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
