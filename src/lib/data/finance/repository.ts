import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { InvoiceStatus } from "@/core/enums/invoiceStatus";
import type { PaymentStatus } from "@/core/enums/paymentStatus";
import type { PaymentType } from "@/core/enums/paymentType";
import type { PaymentMethod } from "@/core/enums/paymentMethod";
import type { ExpenseStatus } from "@/core/enums/expenseStatus";
import type { ExpenseCategory } from "@/core/enums/expenseCategory";
import type { InvoiceInput, PaymentInput, ExpenseInput } from "@/modules/finance/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import type { DataResult } from "@/lib/data/result";

export interface InvoiceFilters {
  search?: string;
  status?: InvoiceStatus | "all";
  clientId?: string;
  eventId?: string;
  contractId?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  overdueOnly?: boolean;
  includeArchived?: boolean;
}

export interface PaymentFilters {
  search?: string;
  status?: PaymentStatus | "all";
  paymentType?: PaymentType | "all";
  paymentMethod?: PaymentMethod | "all";
  clientId?: string;
  eventId?: string;
  invoiceId?: string;
  contractId?: string;
  dateFrom?: string;
  dateTo?: string;
  refundsOnly?: boolean;
}

export interface ExpenseFilters {
  search?: string;
  status?: ExpenseStatus | "all";
  category?: ExpenseCategory | "all";
  eventId?: string;
  clientId?: string;
  unpaidOnly?: boolean;
  dueOnly?: boolean;
  reimbursableOnly?: boolean;
  includeArchived?: boolean;
}

/**
 * The single Finance persistence contract — implemented once by the mock
 * repository (lib/data/finance/mockRepository.ts) and once by the Supabase
 * repository (lib/data/finance/supabaseRepository.ts), exactly mirroring
 * the Leads/Clients/Events/Contracts repository pattern. lib/data/index.ts
 * picks between them via lib/data/provider.ts's selectRepository().
 *
 * Bundles Invoices, Payments, Expenses, and their Notes/Timeline together
 * — same rationale as ContractsRepository/EventsRepository: a successful
 * Payment mutation must recompute its linked Invoice's paid_minor/
 * balance_minor/status atomically, so Invoices and Payments can't live in
 * separate repository files without re-deriving that atomicity twice.
 */
export interface FinanceRepository {
  getInvoices(filters?: InvoiceFilters): Promise<Invoice[]>;
  getInvoiceById(id: string): Promise<Invoice>;
  createInvoice(input: InvoiceInput): Promise<DataResult<Invoice>>;
  updateInvoice(id: string, input: InvoiceInput): Promise<DataResult<Invoice>>;
  issueInvoice(id: string): Promise<DataResult<Invoice>>;
  sendInvoice(id: string): Promise<DataResult<Invoice>>;
  markInvoiceViewed(id: string): Promise<DataResult<Invoice>>;
  markInvoiceOverdue(id: string): Promise<DataResult<Invoice>>;
  voidInvoice(id: string): Promise<DataResult<Invoice>>;
  archiveInvoice(id: string): Promise<DataResult<Invoice>>;
  restoreInvoice(id: string): Promise<DataResult<Invoice>>;
  duplicateInvoice(id: string): Promise<DataResult<Invoice>>;
  getInvoiceNextAction(invoiceId: string): Promise<string | null>;

  getPayments(filters?: PaymentFilters): Promise<Payment[]>;
  getPaymentById(id: string): Promise<Payment>;
  createPayment(input: PaymentInput): Promise<DataResult<Payment>>;
  updatePayment(id: string, input: PaymentInput): Promise<DataResult<Payment>>;
  markPaymentProcessing(id: string): Promise<DataResult<Payment>>;
  markPaymentSucceeded(id: string): Promise<DataResult<Payment>>;
  markPaymentFailed(id: string): Promise<DataResult<Payment>>;
  cancelPayment(id: string): Promise<DataResult<Payment>>;
  refundPayment(originalPaymentId: string, amountMinor: number): Promise<DataResult<Payment>>;
  getPaymentRefundableAmount(paymentId: string): Promise<number>;
  getPaymentNextAction(paymentId: string): Promise<string | null>;

  getExpenses(filters?: ExpenseFilters): Promise<Expense[]>;
  getExpenseById(id: string): Promise<Expense>;
  createExpense(input: ExpenseInput): Promise<DataResult<Expense>>;
  updateExpense(id: string, input: ExpenseInput): Promise<DataResult<Expense>>;
  approveExpense(id: string): Promise<DataResult<Expense>>;
  markExpenseDue(id: string): Promise<DataResult<Expense>>;
  markExpensePaid(id: string): Promise<DataResult<Expense>>;
  markExpenseReimbursed(id: string): Promise<DataResult<Expense>>;
  cancelExpense(id: string): Promise<DataResult<Expense>>;
  archiveExpense(id: string): Promise<DataResult<Expense>>;
  restoreExpense(id: string): Promise<DataResult<Expense>>;
  duplicateExpense(id: string): Promise<DataResult<Expense>>;
  getExpenseNextAction(expenseId: string): Promise<string | null>;

  getNotesByInvoiceId(invoiceId: string): Promise<Note[]>;
  createInvoiceNote(invoiceId: string, input: NoteFormInput): Promise<DataResult<Note>>;
  /** Same null-fallthrough contract as togglePinContractNote/togglePinEventNote — null means "not owned by this Finance sub-type." */
  togglePinInvoiceNote(noteId: string): Promise<DataResult<Note> | null>;
  getTimelineByInvoiceId(invoiceId: string): Promise<TimelineActivity[]>;

  getNotesByPaymentId(paymentId: string): Promise<Note[]>;
  createPaymentNote(paymentId: string, input: NoteFormInput): Promise<DataResult<Note>>;
  togglePinPaymentNote(noteId: string): Promise<DataResult<Note> | null>;
  getTimelineByPaymentId(paymentId: string): Promise<TimelineActivity[]>;

  getNotesByExpenseId(expenseId: string): Promise<Note[]>;
  createExpenseNote(expenseId: string, input: NoteFormInput): Promise<DataResult<Note>>;
  togglePinExpenseNote(noteId: string): Promise<DataResult<Note> | null>;
  getTimelineByExpenseId(expenseId: string): Promise<TimelineActivity[]>;
}
