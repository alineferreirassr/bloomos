import {
  EXPENSE_STATUSES,
  TERMINAL_EXPENSE_STATUSES,
  EXPENSE_STATUS_LABELS,
  type ExpenseStatus,
} from "@/core/enums/expenseStatus";

export { EXPENSE_STATUSES, TERMINAL_EXPENSE_STATUSES, EXPENSE_STATUS_LABELS };
export type { ExpenseStatus };

/**
 * The canonical Expense lifecycle. Every non-`planned` value is reachable
 * only through its own dedicated data-layer action (approveExpense,
 * markExpenseDue, markExpensePaid, markExpenseReimbursed, cancelExpense,
 * archiveExpense, restoreExpense). Restoring an archived Expense returns it
 * to `planned` — the same "reasonable resumption point" precedent as
 * restoreContract/restoreEvent.
 */
const EXPENSE_TRANSITIONS: Record<ExpenseStatus, ExpenseStatus[]> = {
  planned: ["approved", "cancelled", "archived"],
  approved: ["due", "paid", "cancelled", "archived"],
  due: ["paid", "cancelled", "archived"],
  paid: ["reimbursed", "archived"],
  reimbursed: ["archived"],
  cancelled: ["archived"],
  archived: ["planned"],
};

export function canTransitionExpenseStatus(from: ExpenseStatus, to: ExpenseStatus): boolean {
  if (from === to) return false;
  return EXPENSE_TRANSITIONS[from].includes(to);
}

/** Every status `from` can legally move to right now. */
export function getNextExpenseStatuses(from: ExpenseStatus): ExpenseStatus[] {
  return EXPENSE_TRANSITIONS[from];
}

/** True for a status with genuinely nothing left to do — reimbursed/cancelled/archived. */
export function isExpenseTerminal(status: ExpenseStatus): boolean {
  return TERMINAL_EXPENSE_STATUSES.includes(status);
}

interface ExpenseForNextAction {
  status: ExpenseStatus;
  due_date: string | null;
  reimbursable: boolean;
  reimbursed_at: string | null;
}

const DUE_SOON_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Short, human-readable, deterministic suggestion for what to do next with
 * this Expense — mirrors getContractNextRecommendedAction/
 * getInvoiceNextRecommendedAction. Terminal statuses get no suggestion; a
 * paid, reimbursable Expense that hasn't been reimbursed yet is flagged
 * even though `paid` itself would otherwise need nothing further.
 */
export function getExpenseNextRecommendedAction(expense: ExpenseForNextAction): string | null {
  if (isExpenseTerminal(expense.status)) {
    return null;
  }

  const isOverdue = expense.due_date !== null && new Date(expense.due_date).getTime() < Date.now();
  const isDueSoon =
    expense.due_date !== null &&
    !isOverdue &&
    new Date(expense.due_date).getTime() - Date.now() <= DUE_SOON_WINDOW_MS;

  switch (expense.status) {
    case "planned":
      return "Review and approve this expense";
    case "approved":
      if (isOverdue) return "This expense is overdue — pay it as soon as possible";
      if (isDueSoon) return "Payment is due soon";
      return "Mark this expense as due when payment is expected";
    case "due":
      if (isOverdue) return "This expense is overdue — pay it as soon as possible";
      if (isDueSoon) return "Payment is due soon";
      return "Pay this expense";
    case "paid":
      if (expense.reimbursable && expense.reimbursed_at === null) {
        return "Reimburse the team member or supplier";
      }
      return null;
    default:
      return null;
  }
}
