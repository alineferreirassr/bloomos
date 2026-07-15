export const EXPENSE_STATUSES = [
  "planned",
  "approved",
  "due",
  "paid",
  "reimbursed",
  "cancelled",
  "archived",
] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  planned: "Planned",
  approved: "Approved",
  due: "Due",
  paid: "Paid",
  reimbursed: "Reimbursed",
  cancelled: "Cancelled",
  archived: "Archived",
};

/** Statuses reachable only through their own dedicated data-layer action (approveExpense, markExpenseDue, markExpensePaid, markExpenseReimbursed, cancelExpense, archiveExpense). `planned` is assigned outside a dedicated action (on createExpense). */
export const LOCKED_EXPENSE_STATUSES: ExpenseStatus[] = [
  "approved",
  "due",
  "paid",
  "reimbursed",
  "cancelled",
  "archived",
];

/** Statuses with genuinely nothing left to do. */
export const TERMINAL_EXPENSE_STATUSES: ExpenseStatus[] = ["reimbursed", "cancelled", "archived"];
