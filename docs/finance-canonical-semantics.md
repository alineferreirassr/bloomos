# BloomOS Finance — Canonical Semantics

Finance F1 (2026-08). This is the single documented contract for the 12 core
financial terms every future BloomOS Finance surface should use — not a new
accounting engine, just a shared vocabulary layered over the two calculation
paths that already exist (see "Operational vs. ledger" below). Every term
below cites exactly where it's computed today.

**Golden rule: cash and accrual are never the same number, even when they're
close.** A term that says "Cash" or "Paid" means money that has actually
moved. A term that says "Invoiced," "Accrual," "Planned," or "Committed"
means a recognized-but-not-necessarily-collected/paid figure. Never let a UI
label imply one when the underlying number is the other.

## Operational vs. ledger — the two calculation paths

BloomOS has two independently-computed sources for financial totals, and
they are **not the same system**:

- **Operational summaries** (`src/modules/finance/financialSummary.ts`) —
  pure functions that re-sum raw `Invoice`/`Payment`/`Expense`/`Contract`
  rows directly. This is what every Dashboard card, the Event/Client/
  Contract financial summary cards, and the Profitability Center use. Fast,
  simple, and the source for every term in this document.
- **Ledger** (`chart_of_accounts`/`journal_entries`/`journal_lines`,
  posted by `record_expense_transition`/`post_payment_settlement`/
  `post_purchase_receipt`/`record_manual_adjustment` RPCs) — a real
  double-entry system. This is what the four `/finance/reports/*` pages
  (General Ledger, Trial Balance, P&L, Balance Sheet) read.

They agree today only because both trace to the same underlying rows in the
common case. Nothing currently checks that they stay in agreement — see
`src/modules/finance/reconciliation.ts` (added in Finance F1) for a
detection-only mechanism, and the note under each term below for its
classification.

## The 12 terms

### Contract Value
**Source:** `Contract.total_value`, summed per scope via `contractMoneyToMinor()` → `contracted_value_minor` in `financialSummary.ts`.
**Basis:** N/A (a stated commercial value, not revenue recognition).
**Classification:** CANONICAL OPERATIONAL.
**Notes:** Stored as major-unit `numeric` on `Contract` (not `*_minor` like everything else) — converted at read time, never at rest. Excludes cancelled/declined/expired/archived Contracts.

### Invoiced Revenue
**Source:** `invoiced_total_minor` — sum of `Invoice.total_minor` for non-voided invoices, `financialSummary.ts:80`.
**Basis:** Accrual — recognized when billed, regardless of collection.
**Classification:** CANONICAL OPERATIONAL.
**Reconciliation note:** No ledger equivalent exists as a standalone figure — the P&L report's revenue section is the closest ledger-side analog (`finance_profit_and_loss_report` RPC, reading `journal_lines` posted by `post_payment_settlement`, not by invoice issuance itself). RECONCILIATION REQUIRED if the two are ever compared directly — see reconciliation.ts.

### Collected Cash
**Source:** `collected_minor` — real (non-refund, status-counts-toward-paid) Payments minus refund Payments, `financialSummary.ts:83-89`.
**Basis:** Cash — money that has actually arrived.
**Classification:** CANONICAL OPERATIONAL.
**Notes:** Collected Cash is **not** Revenue. An event can have $0 Collected Cash and still show real Invoiced Revenue if nothing's been paid yet.

### Outstanding Receivables
**Source:** Event/Client scope: `outstanding_minor`, sum of each non-voided Invoice's own `balance_minor` (`financialSummary.ts:81`). Workspace scope: `outstanding_receivables_minor` (`financialSummary.ts:245-247`), a point-in-time snapshot, not month-scoped.
**Basis:** Accrual (what's still owed against what's been billed).
**Classification:** CANONICAL OPERATIONAL.
**Notes:** Deliberately summed from each Invoice's own live-maintained `balance_minor` rather than `invoiced − collected`, so a standalone Payment with no `invoice_id` never gets double-counted as "collected but not invoiced."

### Planned Expenses
**Source:** NEW in Finance F1 — `planned_expense_total_minor`, sum of `Expense.amount_minor` where `status === "planned"` (`financialSummary.ts`).
**Basis:** Accrual, earliest stage — a cost estimate not yet approved.
**Classification:** CANONICAL OPERATIONAL.

### Committed Expenses
**Source:** NEW in Finance F1 — `committed_expense_total_minor`, sum where `status` is `"approved"` or `"due"`.
**Basis:** Accrual — approved and/or obligated, but no cash has left the business yet.
**Classification:** CANONICAL OPERATIONAL.

### Paid Expenses
**Source:** NEW in Finance F1 — `paid_expense_total_minor`, sum where `status` is `"paid"` or `"reimbursed"`.
**Basis:** Cash — money that has actually left the business.
**Classification:** CANONICAL OPERATIONAL.
**Reconciliation note:** This is the operational-side number that should, in principle, track the ledger's own expense-related postings from `record_expense_transition`. RECONCILIATION REQUIRED — see reconciliation.ts.
**Known gap:** `planned + committed + paid` will not always equal `expense_total_minor` ("Accrual Expenses" below), because an `"archived"` Expense still counts toward the accrual total but its pre-archive status isn't separately preserved. This is a real, disclosed gap, not a bug to silently work around.

### Accrual Expenses
**Source:** `expense_total_minor` — every non-cancelled Expense regardless of payment status (`financialSummary.ts:91`, unchanged since before Finance F1).
**Basis:** Accrual, broadest — status-blind.
**Classification:** CANONICAL OPERATIONAL.

### Gross Profit
**Source:** `gross_profit_minor` = Invoiced Revenue − Accrual Expenses (`financialSummary.ts:93`, unchanged).
**Basis:** Revenue-basis (accrual revenue, accrual expenses).
**Classification:** DERIVED PRESENTATIONAL.
**Meaning:** "What this Event is expected to net once everything billed is collected and every committed cost is accounted for."

### Net Profit
**Source:** `net_profit_minor` = Collected Cash − Accrual Expenses (`financialSummary.ts:94`, unchanged).
**Basis:** A deliberate hybrid — cash revenue, accrual expenses. This predates Finance F1 and was **not** redefined by this pass.
**Classification:** DERIVED PRESENTATIONAL.
**Caution:** This is the one term in this document whose name doesn't fully describe its basis — "Net" here does not mean "fully cash-basis." Use Cash Profit below when a pure cash-in/cash-out figure is needed.

### Cash Profit
**Source:** NEW in Finance F1 — `cash_profit_minor` = Collected Cash − Paid Expenses.
**Basis:** Pure cash — both sides are money that has actually moved.
**Classification:** DERIVED PRESENTATIONAL.
**Meaning:** The one profit figure in this summary where both inputs are real, realized cash.

### Profit Margin
**Source:** NEW in Finance F1 — `gross_margin_percent` = Gross Profit ÷ Invoiced Revenue × 100, via the existing `calculatePercentage()` helper. Returns `0` when Invoiced Revenue is `0` (never divides by zero); returns a **negative** value when expenses exceed revenue, deliberately not clamped to 0.
**Basis:** Revenue-basis (pairs with Gross Profit).
**Classification:** DERIVED PRESENTATIONAL.

## Where these terms live

`src/modules/finance/financialSummary.ts` — `EventFinancialSummary` (shared by `computeEventFinancialSummary`/`computeClientFinancialSummary`) carries every term above except the workspace-only Outstanding Receivables variant, which lives in `WorkspaceFinancialSummary` instead. Finance F1 added five new fields (`planned_expense_total_minor`, `committed_expense_total_minor`, `paid_expense_total_minor`, `cash_profit_minor`, `gross_margin_percent`) purely additively — no existing field's name or meaning changed.

**Redaction note for anyone wiring these into a new UI surface:** `financeActions.ts`'s `redactFinancialSummary()` is a hand-maintained allowlist, not a generic spread — the five new fields are **not yet threaded through it**. Before surfacing `cash_profit_minor`/`gross_margin_percent` anywhere, gate them behind `finance.executive.view` (the same gate `gross_profit_minor`/`net_profit_minor` already use); the three new expense-breakdown fields should follow `finance.amounts.view`, the same gate `expense_total_minor` already uses.
