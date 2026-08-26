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
  InvoiceAdjustmentInput,
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
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";
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
  /** `context` optionally injects an already-authenticated server Supabase client + Workspace session — see EventsRepository's identical doc comment. Ignored by the mock implementation. */
  getInvoices(filters?: InvoiceFilters, context?: ServerRepositoryContext): Promise<Invoice[]>;
  getInvoiceById(id: string): Promise<Invoice>;
  /** Finance F2.1C-F-E-D-B1: invoiceId is a required, caller-generated request-idempotency key (kept separate from the Founder-authored InvoiceInput payload) — a retry with the same id and the same payload replays the original Invoice instead of creating a second one; the same id with a different payload is rejected as a conflict. The comparison is against an immutable snapshot of the original creation payload, never against the Invoice's current, independently-editable columns, since updateInvoice can legitimately change the same fields after creation. */
  createInvoice(input: InvoiceInput, invoiceId: string): Promise<DataResult<Invoice>>;
  updateInvoice(id: string, input: InvoiceInput): Promise<DataResult<Invoice>>;
  issueInvoice(id: string): Promise<DataResult<Invoice>>;
  sendInvoice(id: string): Promise<DataResult<Invoice>>;
  markInvoiceViewed(id: string): Promise<DataResult<Invoice>>;
  markInvoiceOverdue(id: string): Promise<DataResult<Invoice>>;
  /**
   * Finance F2.1C-D-D-B. Unified void/cancellation. If `invoice.paid_minor`
   * is 0, behaves exactly as before (full reversal of Revenue recognition).
   * If a payment has settled but a balance remains, the settled economic
   * portion stays recognized and only the genuinely unpaid CURRENT
   * remainder is cancelled via one balanced append-only Journal Entry
   * (source_type 'invoice_partial_void') — Cash and Customer Deposits are
   * never touched, no automatic refund or deposit is created. Rejects if
   * the invoice has no outstanding balance (fully paid — use `refundPayment`
   * or `recordInvoiceAdjustment` instead) or if an unresolved Customer
   * Deposit Application exists on the invoice (no reversal capability
   * exists yet).
   *
   * `cancellationId` is a REQUIRED, caller-supplied request-level
   * idempotency key — same contract as `refundPayment`'s `refundPaymentId`
   * (see its doc comment), scoped to the Partial-Payment Cancellation path
   * only (clean void's own existing behavior on retry is unchanged: a hard
   * reject, not a replay). `reason` is required for audit/timeline context.
   */
  voidInvoice(id: string, cancellationId: string, reason: string): Promise<DataResult<Invoice>>;
  archiveInvoice(id: string): Promise<DataResult<Invoice>>;
  restoreInvoice(id: string): Promise<DataResult<Invoice>>;
  duplicateInvoice(id: string): Promise<DataResult<Invoice>>;
  getInvoiceNextAction(invoiceId: string): Promise<string | null>;
  /**
   * Finance F2.1C-D-C. Post-issuance financial correction for an Invoice
   * that has already left draft — the current subtotal/tax/discount are
   * changed to `input`'s values (total is always server-derived), a single
   * balanced append-only Journal Entry (source_type 'invoice_adjustment')
   * captures the signed delta, and the Invoice's own current economic
   * fields plus paid_minor/balance_minor/status are recomputed atomically.
   * Only invoices in {issued, sent, viewed, partially_paid, paid, overdue}
   * are eligible — draft invoices use `updateInvoice` instead, voided/
   * archived invoices are terminal. Rejects a downward correction that
   * would drop the total below what has already been collected (via cash
   * payment or Customer Deposit Application) — refund the excess first.
   * Rejects a no-op (all three fields already match the request).
   *
   * `adjustmentId` is a REQUIRED, caller-supplied request-level idempotency
   * key — same contract as `refundPayment`'s `refundPaymentId` (see its doc
   * comment): generate once per intended correction, reuse on retry, never
   * regenerate. A repeat call with the same key and the same target
   * subtotal/tax/discount replays the original result (the Invoice,
   * unchanged); a repeat with the same key but a different target fails as
   * a conflict.
   */
  recordInvoiceAdjustment(invoiceId: string, input: InvoiceAdjustmentInput, adjustmentId: string): Promise<DataResult<Invoice>>;

  /** `context` optionally injects an already-authenticated server Supabase client + Workspace session — see EventsRepository's identical doc comment. Ignored by the mock implementation. */
  getPayments(filters?: PaymentFilters, context?: ServerRepositoryContext): Promise<Payment[]>;
  getPaymentById(id: string): Promise<Payment>;
  /** paymentId is a required, caller-generated request-idempotency key for the immediately-succeeded path (kept separate from PaymentInput) — see recordPaymentSettlement's own doc comment for the shared semantics. A pending-status Payment (this path's other branch) does not yet participate in this idempotency mechanism. */
  createPayment(input: PaymentInput, paymentId: string): Promise<DataResult<Payment>>;
  updatePayment(id: string, input: PaymentInput): Promise<DataResult<Payment>>;
  markPaymentProcessing(id: string): Promise<DataResult<Payment>>;
  markPaymentSucceeded(id: string): Promise<DataResult<Payment>>;
  markPaymentFailed(id: string): Promise<DataResult<Payment>>;
  cancelPayment(id: string): Promise<DataResult<Payment>>;
  /**
   * Finance F2.1C-C-IDEMPOTENCY. `refundPaymentId` is a REQUIRED, caller-
   * supplied request-level idempotency key (generate with `crypto.
   * randomUUID()` ONCE per intended refund action and reuse the SAME value
   * on any retry of that same request — never regenerate on retry, that
   * defeats the purpose). A repeat call with the same key and the same
   * (originalPaymentId, amountMinor) payload replays the original refund
   * unchanged rather than creating a second one; a repeat with the same key
   * but a different payload fails as a conflict. A different key represents
   * a distinct, intentional second refund, subject to the refundable ceiling.
   */
  refundPayment(originalPaymentId: string, amountMinor: number, refundPaymentId: string): Promise<DataResult<Payment>>;
  getPaymentRefundableAmount(paymentId: string): Promise<number>;
  getPaymentNextAction(paymentId: string): Promise<string | null>;

  /**
   * Finance F2.1C-C. Applies part or all of an unapplied Customer Deposit (a Payment with invoice_id null) to a target Invoice — Dr 2200 Customer Deposits / Cr 1100 Accounts Receivable, no Cash line. Returns the new application Payment (payment_type='adjustment', reference='deposit_application_of:<depositPaymentId>').
   *
   * Finance F2.1C-C-IDEMPOTENCY. `applicationPaymentId` is a REQUIRED, caller-
   * supplied request-level idempotency key — same contract as `refundPayment`'s
   * `refundPaymentId` (see its doc comment): generate once per intended
   * application action, reuse on retry, never regenerate.
   */
  applyDepositToInvoice(depositPaymentId: string, invoiceId: string, amountMinor: number, applicationPaymentId: string): Promise<DataResult<Payment>>;
  /** The deposit's own amount minus every prior completed refund and every prior completed application of it, plus every prior completed reversal of one of those applications (Finance F2.1C-E-B). 0 if the payment isn't an unapplied Customer Deposit in a consumable status. */
  getDepositApplicableAmount(depositPaymentId: string): Promise<number>;

  /**
   * Finance F2.1C-E-B. Reverses ONE exact, already-posted Deposit
   * Application in full — FULL_ONLY, never partial; the reversal amount is
   * always the target Application's own `amount_minor`, never
   * caller-supplied. Restores the Customer Deposit liability and the
   * Invoice's AR position: Dr 1100 Accounts Receivable / Cr 2200 Customer
   * Deposits — the exact inverse of `applyDepositToInvoice`'s own posting.
   * No Cash, Revenue, Tax, or Discount line — this is a pure balance-sheet
   * reallocation, never a P&L or Cash event. The original Application
   * Payment/Journal Entry is never mutated (append-only); the reversal is
   * represented as a NEW Payment row (`payment_type: 'refund'` — reused
   * ONLY so the existing `recompute_invoice_balance` correctly subtracts it
   * from `paid_minor`, never as a claim that Cash moved — `reference:
   * 'deposit_application_reversal_of:<applicationPaymentId>'` keeps it
   * unambiguous in the audit trail). Rejects an Invoice in a
   * reversal-ineligible status (draft/voided/archived) and an Application
   * that has already been reversed once (FULL_ONLY has no partial-remaining
   * concept).
   *
   * Finance F2.1C-E-B-IDEMPOTENCY. `reversalId` is a REQUIRED, caller-
   * supplied request-level idempotency key — same contract as
   * `refundPayment`'s `refundPaymentId` (see its doc comment): generate
   * once per intended reversal action, reuse on retry, never regenerate. A
   * repeat call with the same key and the same target Application replays
   * the original result unchanged; a repeat with the same key but a
   * different target Application fails as a conflict.
   */
  reverseDepositApplication(applicationPaymentId: string, reversalId: string, reason: string): Promise<DataResult<Payment>>;

  /** `context` optionally injects an already-authenticated server Supabase client + Workspace session — see EventsRepository's identical doc comment. Ignored by the mock implementation. */
  getExpenses(filters?: ExpenseFilters, context?: ServerRepositoryContext): Promise<Expense[]>;
  getExpenseById(id: string): Promise<Expense>;
  /** Finance F2.1C-F-E-D-B2: expenseId is a required, caller-generated request-idempotency key (kept separate from the Founder-authored ExpenseInput payload) — a retry with the same id and the same payload replays the original Expense instead of creating a second one; the same id with a different payload is rejected as a conflict. The comparison is against an immutable snapshot of the original creation payload, never against the Expense's current, independently-editable columns, since updateExpense can legitimately change the same fields after creation. */
  createExpense(input: ExpenseInput, expenseId: string): Promise<DataResult<Expense>>;
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

  /** Calls record_payment_settlement. Rejects payment_method='stripe' at this boundary too (Stripe remains deferred), independent of the RPC's own P1117 rejection. Finance F2.1C-F-E-C: paymentId is a required, caller-generated request-idempotency key (kept separate from the Founder-authored PaymentSettlementInput payload) — a retry with the same id and the same payload replays the original Payment instead of posting a second settlement; the same id with a different payload is rejected as a conflict. createPayment's own immediately-succeeded path shares this exact mechanism (both compose into the same underlying settled-payment engine path). */
  recordPaymentSettlement(input: PaymentSettlementInput, paymentId: string): Promise<DataResult<Payment>>;
  /** Calls record_expense_transition. */
  recordExpenseTransition(expenseId: string, input: ExpenseTransitionInput): Promise<DataResult<Expense>>;
  /** Calls record_manual_adjustment. Balance equality is validated by the RPC, not re-checked here. manualAdjustmentId is a required, caller-generated request-idempotency key (kept separate from the Founder-authored ManualAdjustmentInput payload) — a retry with the same id and the same payload replays the original Journal Entry instead of posting a second one; the same id with a different payload is rejected as a conflict. */
  recordManualAdjustment(input: ManualAdjustmentInput, manualAdjustmentId: string): Promise<DataResult<JournalEntry>>;
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
