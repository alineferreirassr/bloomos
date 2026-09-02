import Link from "next/link";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { ExpenseStatusBadge } from "@/modules/finance/components/ExpenseStatusBadge";
import { ExpenseCategoryBadge } from "@/modules/finance/components/ExpenseCategoryBadge";
import { formatMoney } from "@/lib/money";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { ExpenseListRow } from "@/modules/finance/components/ExpensesListView";

export function ExpenseListCards({ rows }: { rows: ExpenseListRow[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {rows.map(({ expense, event, nextAction }) => (
        <Link key={expense.id} href={`/finance/expenses/${expense.id}`} className="block">
          <LuxuryCard>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium tracking-tight text-text">{expense.description}</p>
                <p className="mt-0.5 text-xs text-text-muted">{formatEventDate(expense.transaction_date)}</p>
                {event ? <p className="mt-0.5 text-xs text-text-muted">{event.title}</p> : null}
              </div>
              <div className="flex flex-col items-end gap-1">
                <ExpenseCategoryBadge category={expense.category} />
                <ExpenseStatusBadge status={expense.status} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
              <span className="font-medium text-text">{formatMoney(expense.amount_minor, expense.currency)}</span>
              {expense.due_date ? <span>Due {formatEventDate(expense.due_date)}</span> : null}
              {expense.reimbursable ? <span>Reimbursable</span> : null}
            </div>
            {nextAction ? <p className="mt-2 text-xs text-accent">{nextAction}</p> : null}
          </LuxuryCard>
        </Link>
      ))}
    </div>
  );
}
