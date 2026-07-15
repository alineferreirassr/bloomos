import type { ExpenseCategory } from "@/core/enums/expenseCategory";
import type { ExpenseStatus } from "@/core/enums/expenseStatus";

/**
 * A cost the business incurs — Event-specific (`event_id` set), a general
 * business expense (both `event_id`/`client_id` null), or supplier/team-
 * related. `supplier_id` and `team_member_id` are forward-looking
 * placeholders only: no Supplier or Team module exists yet, so neither is
 * validated against a real table today — they simply carry an id (or null)
 * for whichever future module fills them in, the same "field exists, no
 * module owns it yet" precedent as Contract Exhibit's `document_id`.
 *
 * `amount_minor` is an integer minor-unit amount (see lib/money.ts), always
 * positive. `reimbursable` marks an Expense a team member or supplier
 * fronted and expects to be paid back for — distinct from `status:
 * "reimbursed"`, which is *whether* that reimbursement has actually
 * happened yet (a reimbursable Expense starts `reimbursable: true`,
 * `reimbursed_at: null`, and only gets `reimbursed_at` set once
 * markExpenseReimbursed runs). `document_id` stays null until the future
 * Documents module can attach a receipt or reimbursement proof.
 */
export interface Expense {
  id: string;
  workspace_id: string;
  event_id: string | null;
  client_id: string | null;
  contract_id: string | null;
  supplier_id: string | null;
  team_member_id: string | null;
  category: ExpenseCategory;
  status: ExpenseStatus;
  description: string;
  amount_minor: number;
  currency: string;
  transaction_date: string;
  due_date: string | null;
  paid_at: string | null;
  reimbursable: boolean;
  reimbursed_at: string | null;
  reference: string | null;
  notes: string | null;
  document_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
