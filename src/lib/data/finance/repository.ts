import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { ChartOfAccount } from "@/types/chartOfAccount";
import type { JournalEntry } from "@/types/journalEntry";
import type { AccountingPeriod } from "@/types/accountingPeriod";
import type { InvoiceStatus } from "@/core/enums/invoiceStatus";
import type { PaymentStatus } from "@/core/enums/paymentStatus";
import type { PaymentType } from "@/core/enums/paymentType";
import type { PaymentMethod } from "@/core/enums/paymentMethod";
import type { ExpenseStatus } from "@/core/enums/expenseStatus";
import type { ExpenseCategory } from "@/core/enums/expenseCategory";
import type { AccountType } from "@/core/enums/accountType";
import type { PostingStatus } from "@/core/enums/postingStatus";
import type { AccountingPeriodStatus } from "@/core/enums/accountingPeriodStatus";
import type {
  InvoiceInput,
  PaymentInput,
  ExpenseInput,
  ManualAdjustmentInput,
  PaymentSettlementInput,
  ExpenseTransitionInput,
  JournalEntryReversalInput,
  AccountingPeriodCreateInput,
} from "@/modules/finance/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import type { DataResult } from "@/lib/data/result";
import type {
  GeneralLedgerReport,
  TrialBalanceReport,
  ProfitAndLossReport,
  BalanceSheetReport,
} from "@/types/financeReport";

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

export interface ChartOfAccountFilters {
  includeArchived?: boolean;
  accountType?: AccountType | "all";
}

export interface JournalEntryFilters {
  dateFrom?: string;
  dateTo?: string;
  sourceType?: string | "all";
  postingStatus?: PostingStatus | "all";
  /** Filters to entries with at least one line against this account — a real join, not a client-side filter, so it stays efficient at any entry volume. */
  accountId?: string;
  /** Defaults to 50 (see supabaseRepository.ts/mockRepository.ts) — Journal Entries have no existing pagination precedent elsewhere in this codebase, so this uses Postgrest's native .range() rather than inventing a cursor/page-token scheme. */
  limit?: number;
  offset?: number;
}

export interface AccountingPeriodFilters {
  status?: AccountingPeriodStatus | "all";
}

/**
 * Finance Reports Foundation filter shapes — every field is a plain string/
 * boolean, matching the request body of the corresponding
 * finance_*_report RPC (mock/Supabase parity means these are the ONLY
 * inputs either implementation needs). See docs/finance-reports.md.
 */
export interface GeneralLedgerReportFilters {
  startDate: string;
  endDate: string;
  accountId?: string;
  accountType?: AccountType;
  sourceType?: string;
}

export interface TrialBalanceReportFilters {
  asOfDate: string;
  includeZeroBalances?: boolean;
}

export interface ProfitAndLossReportFilters {
  startDate: string;
  endDate: string;
  comparison?: { startDate: string; endDate: string };
}

export interface BalanceSheetReportFilters {
  asOfDate: string;
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

  // ---------------------------------------------------------------------
  // Finance Ledger (Repository Layer phase) — consumes the already-
  // approved Finance Posting Engine RPCs; never recreates accounting logic
  // already implemented in Postgres. Read methods return the plain domain
  // object or throw NotFoundError (matching getInvoiceById's own
  // convention); write methods return DataResult<T> (matching every other
  // mutation in this interface) and write exactly one Core Audit entry
  // after a successful RPC call.
  // ---------------------------------------------------------------------

  listChartOfAccounts(filters?: ChartOfAccountFilters): Promise<ChartOfAccount[]>;
  getChartOfAccount(id: string): Promise<ChartOfAccount>;

  listJournalEntries(filters?: JournalEntryFilters): Promise<JournalEntry[]>;
  /** Includes `lines` (with `account` enrichment) — see JournalEntry's own doc comment for why list omits them. */
  getJournalEntry(id: string): Promise<JournalEntry>;

  listAccountingPeriods(filters?: AccountingPeriodFilters): Promise<AccountingPeriod[]>;
  getAccountingPeriod(id: string): Promise<AccountingPeriod>;

  /** Calls record_payment_settlement. Rejects payment_method='stripe' at this boundary too (Stripe remains deferred), independent of the RPC's own P1117 rejection. */
  recordPaymentSettlement(input: PaymentSettlementInput): Promise<DataResult<Payment>>;
  /** Calls record_expense_transition. */
  recordExpenseTransition(expenseId: string, input: ExpenseTransitionInput): Promise<DataResult<Expense>>;
  /** Calls record_manual_adjustment. Balance equality is validated by the RPC, not re-checked here. */
  recordManualAdjustment(input: ManualAdjustmentInput): Promise<DataResult<JournalEntry>>;
  /** Calls reverse_journal_entry. Never updates the original entry directly — the RPC sets reversed_by_entry_id itself. */
  reverseJournalEntry(journalEntryId: string, input: JournalEntryReversalInput): Promise<DataResult<JournalEntry>>;

  /** Calls create_accounting_period. */
  createAccountingPeriod(input: AccountingPeriodCreateInput): Promise<DataResult<AccountingPeriod>>;
  /** Calls close_period. */
  closeAccountingPeriod(id: string): Promise<DataResult<AccountingPeriod>>;
  /** Calls lock_period. */
  lockAccountingPeriod(id: string): Promise<DataResult<AccountingPeriod>>;

  // ---------------------------------------------------------------------
  // Finance Reports Foundation — derives exclusively from journal_entries/
  // journal_lines/chart_of_accounts (never invoices/payments/expenses/
  // purchases/inventory_movements directly). Reads; throw on failure
  // (an invalid date range throws a plain Error via
  // throwFinanceReportError), matching every other read method in this
  // interface. Cash Flow / AR Aging / AP Aging are not implemented in this
  // phase — see docs/finance-reports.md's Deferred Reports section for the
  // exact, individually documented schema gap behind each one.
  // ---------------------------------------------------------------------

  getGeneralLedgerReport(filters: GeneralLedgerReportFilters): Promise<GeneralLedgerReport>;
  getTrialBalanceReport(filters: TrialBalanceReportFilters): Promise<TrialBalanceReport>;
  getProfitAndLossReport(filters: ProfitAndLossReportFilters): Promise<ProfitAndLossReport>;
  getBalanceSheetReport(filters: BalanceSheetReportFilters): Promise<BalanceSheetReport>;
}
