# Finance Reports Foundation

Domain types, database-side aggregation RPCs, and Repository methods for four
Finance reports: General Ledger, Trial Balance, Profit and Loss, and Balance
Sheet. This phase deliberately does **not** include a Reports UI, charts,
exports, or Stripe.

## Reporting principles

Every report derives exclusively from the ledger — `journal_entries`,
`journal_lines`, `chart_of_accounts`, `accounting_periods` — never from
`invoices`, `payments`, `expenses`, `purchases`, or `inventory_movements`
directly. Those operational tables may only be used for traceability or
drill-down metadata in a future phase, never to calculate a balance.

Only `posting_status = 'posted'` Journal Entries participate. A reversal is
represented naturally through its own posted, `source_type = 'reversal'`
entry with every line's debit/credit swapped — never by hiding or rewriting
the entry it reverses.

All money stays in integer minor units throughout every RPC, TypeScript
helper, and domain type. No floating-point arithmetic is used anywhere in
this phase.

Every normal-balance calculation reads `chart_of_accounts.normal_balance` as
the authority — nothing hardcodes a balance rule by account type. See
`calculateNormalBalance` in `src/lib/data/finance/reportCalculations.ts`.

## Architecture

**Database-side aggregation, not client-side.** Four new RPCs
(`finance_general_ledger_report`, `finance_trial_balance_report`,
`finance_profit_and_loss_report`, `finance_balance_sheet_report`, all in
`supabase/migrations/20260805100000_finance_report_rpcs.sql`) do the actual
SUM/JOIN work in Postgres. These are the first **read** RPCs in this schema
— every prior Finance RPC is a write (a posting or period-lifecycle
mutation) — introduced specifically so the browser never has to load the
whole ledger to compute a statement, and so the accounting math lives in one
place instead of being re-derived in TypeScript where it could drift.

Each RPC is `security invoker` + `set search_path = public`, matching every
existing RPC, and additionally `stable` (an accurate, new declaration none of
the write RPCs needed, since these never modify data). No explicit
workspace-membership check happens inside any of them — exactly like every
existing RPC, they rely on RLS: a `security invoker` function runs as the
calling user, and `chart_of_accounts`/`journal_entries`/`journal_lines` all
already carry a `select` policy scoped to `is_workspace_member(workspace_id)`.
`p_workspace_id` remains an explicit parameter for the same reason every
existing read query in this codebase passes it explicitly on top of RLS —
"which of my own workspaces," not a second security boundary.

A single new error code, **P1200**, covers every report's input-validation
failure (a missing or inverted date range, a comparison period missing one
of its two dates) — a report's date range is either syntactically valid or
it is not, so the finer P1100-range granularity the Posting Engine's writes
needed isn't necessary here.

**Shared pure calculation helpers**
(`src/lib/data/finance/reportCalculations.ts`) assemble the RPCs' flat
result rows into the nested report domain shape, and the mock repository
reuses the exact same functions over its own aggregated rows — the two
repositories can never compute a report differently:

- `calculateNormalBalance` — a signed balance in an account's own normal
  direction.
- `calculateRunningBalance` — seeds from an opening balance, accumulates in
  order.
- `splitEndingBalance` / `validateTrialBalance` — places a Trial Balance row
  on its actual (not "normal") side, and confirms total debits equal total
  credits.
- `validateAccountingEquation` — Assets = Liabilities + Equity.
- `groupAccountsByType` / `calculateVariance` — generic organizing helpers.
- `buildProfitAndLossSections` / `buildBalanceSheetSections` — the one place
  section/subtotal assembly happens for each of those two reports.

**Reads throw, they don't return `DataResult`** — matching
`getChartOfAccount`/`getJournalEntry`'s own convention. A report's own
P1200 validation failure throws a plain, safe `Error` via
`throwFinanceReportError` (`src/lib/data/finance/errors.ts`), never a raw
Postgres internal.

## Reporting index review

No new index was added. Two indexes already committed by the Database Schema
phase cover every query shape these four RPCs use:

- `journal_entries_workspace_date_idx (workspace_id, entry_date)` — every
  report filters by workspace and date range.
- `journal_lines_account_workspace_idx (account_id, workspace_id)` — this
  index's own migration comment already anticipated this exact use case:
  "the index every P&L/Balance Sheet report query depends on."

Adding a redundant index on top of either would provide no measurable
benefit at this data volume and was avoided.

## General Ledger

`getGeneralLedgerReport({ startDate, endDate, accountId?, accountType?, sourceType? })`

Every eligible account appears exactly once in `GeneralLedgerReport.accounts`
— including one with zero activity in the requested range, whose opening
balance simply carries through unchanged as its closing balance (the RPC is
driven from `eligible_accounts`, not from the activity rows themselves, so a
quiet account is never silently omitted).

`openingBalanceMinor` is every posted line strictly before `startDate`.
Transactions carry a `runningBalanceMinor` computed in true chronological
order — entry date, then Journal Entry `created_at`, then entry id, then
line id — fully deterministic even when several entries share a date.

`sourceType` narrows which transactions are **displayed**, never the
opening/running balance math itself — a balance recomputed only from a
filtered subset of sources would silently violate "opening + movement =
closing" for the account as a whole.

## Trial Balance

`getTrialBalanceReport({ asOfDate, includeZeroBalances? })`

Placement is by the row's actual net direction (`totalDebit - totalCredit`),
never by the account's own "normal" side — this is what lets a contra-account
or an abnormally-pushed account still report correctly, and it's exactly
what `splitEndingBalance` encodes. `TrialBalanceReport.isBalanced` is an
explicit, first-class field: the RPC never silently corrects an unbalanced
result, and a `false` value always signals a genuine data problem, since the
ledger's own balanced-entry invariant (`finance_check_journal_entry_balanced`)
guarantees a balanced trial balance in the normal case.

An archived account with historical activity remains visible regardless of
`includeZeroBalances` — only a truly zero-activity account can be hidden by
that flag.

## Profit and Loss

`getProfitAndLossReport({ startDate, endDate, comparison? })`

A **flow**, not a running balance — computed purely from movement during
`[startDate, endDate]`, since this ledger has no period-closing mechanism
that would otherwise reset revenue/expense accounts between periods (see
Current-Period Earnings Treatment below).

Sections map directly and losslessly from the seeded `account_type` values —
no keyword-based classification was needed or used:

| Section | account_type(s) |
| --- | --- |
| Revenue | `revenue`, `contra_revenue` (netted — see below) |
| Cost of Goods Sold | `cost_of_goods_sold` |
| Operating Expenses | `operating_expense` |
| Other Income | `other_income` |
| Other Expense | `other_expense` |

Revenue is the one section mixing two different `normal_balance` values
(credit-normal revenue, debit-normal contra_revenue). Its section total is
computed via the type-agnostic net-income contribution formula
(`creditMinor - debitMinor`, which is negative for a debit-normal
contra_revenue row) so contra_revenue correctly *nets against* revenue
instead of adding to it — while each row still displays its own natural,
type-consistent positive magnitude for readability. Every other section
contains a single `normal_balance`, so its total is simply the sum of its
rows.

Rollups follow the standard income statement structure exactly:

```
Gross Profit     = Revenue (net of contra_revenue) − Cost of Goods Sold
Operating Income = Gross Profit − Operating Expenses
Net Income       = Operating Income + Other Income − Other Expense
```

## Balance Sheet

`getBalanceSheetReport({ asOfDate })`

Assets/Liabilities/Equity map directly from `account_type` — a cumulative
balance through `asOfDate`, unlike Profit and Loss's flow.

### Current-period earnings treatment

**No closing-entry mechanism exists anywhere in this ledger** — nothing in
the entire Posting Engine ever posts to `3900 Retained Earnings`, and this
phase does not add one (per the brief: "Do not create closing Journal
Entries in this phase"). Without it, `Assets = Liabilities + Equity` would
only hold if the ledger's cumulative revenue/expense activity is included
somewhere in Equity — omitting it breaks the accounting equation, and
folding it silently into the (always-zero) `3900` account balance would
misrepresent an account nothing actually posted to.

The correct, non-speculative reporting-only treatment: `currentPeriodEarningsMinor`
is the cumulative net income (`creditMinor - debitMinor` summed uniformly
across every income-statement line, regardless of each account's own
`normal_balance` — the sign already comes out correct without a per-account
`CASE`) of every income-statement account **from the ledger's inception**
through `asOfDate`. It appears as a single, clearly labeled synthetic line —
"Current Period Earnings (Unclosed)" — within the Equity section, on top of
whatever the real, posted equity accounts already carry.

`BalanceSheetReport.isBalanced` is an explicit field (via
`validateAccountingEquation`), never silently forced true.

**It is report-only.** `currentPeriodEarningsMinor` is computed fresh on
every call — it is never written to `chart_of_accounts`, `journal_entries`,
or any other table, and no Chart of Accounts row represents it. It behaves
correctly for a net loss too: if cumulative expenses exceed cumulative
revenue, `creditMinor - debitMinor` is simply negative, `totalEquityMinor`
falls by that amount, and the accounting equation still holds — nothing
about the formula assumes a profit.

**Why "since ledger inception" does not double-count once real closing
entries eventually exist.** This was the sharpest open question for this
design, and it resolves cleanly: a future closing entry, whatever its exact
shape, must itself be a Journal Entry with lines against the income-statement
accounts it closes (a debit to Revenue, a credit to an Expense account, etc.)
to zero them out, paired with an offsetting line against an Equity account
(`3900` or otherwise). Because `currentPeriodEarningsMinor` is a **sum over
all posted income-statement lines through `asOfDate`, including the closing
entry's own lines**, a closed period's revenue/expense accounts net to
exactly zero in that sum the moment the closing entry posts — the closing
entry cancels the very activity it closes, in the same cumulative
calculation. The amount it moved into `3900` (or wherever it posted) is
picked up separately, correctly, by the ordinary Equity-section aggregation
of posted equity-account balances. Nothing is counted twice: unclosed
activity shows up only in `currentPeriodEarningsMinor`; closed activity
shows up only in the real equity account's balance.

This self-correcting property has one real precondition: a future closing
engine must route every closing entry between accounts classified as
`account_type in ('revenue', 'contra_revenue', 'cost_of_goods_sold',
'operating_expense', 'other_income', 'other_expense')` on one side and an
`equity` account on the other — never through an intermediate account
classified outside those two groups (e.g. a hypothetical "Income Summary"
account misclassified as something else), which could leave a residual
balance that is neither zeroed by this formula nor counted as a real equity
balance. No closing engine exists yet, so this is a constraint on that
future design, not a limitation of the current one.

## Deferred reports

### Cash Flow Statement — deferred

`chart_of_accounts` carries no operating/investing/financing classification
of any kind, and every `journal_entries.source_type` in this schema
(`purchase_receipt`, `payment_settlement`, `expense_due`/`paid`/`reimbursed`,
inventory movements, manual adjustments) reflects ordinary day-to-day
operating activity for a small services business — there is no investing or
financing source type that ever actually posts. Classifying activity by
source-type guesswork rather than a structured field would be exactly the
speculative logic the brief prohibits.

Worse, the indirect method's own working-capital adjustments (change in
Accounts Receivable, change in Accounts Payable) would depend on the same
unreliable AR/AP balances documented below — so even a naive first version
would be built on data this ledger doesn't actually support.

**Minimal future metadata needed:** a `cash_flow_category` column (or
equivalent classification table) on `chart_of_accounts`, populated
deliberately per account, plus a resolved settlement-allocation model for
AR/AP (see below) before the indirect method's working-capital line items
can be trusted.

### Accounts Receivable Aging — deferred

No RPC in this Posting Engine ever posts an `invoice_issued` (or
`invoice_voided`) Journal Entry — `1100 Accounts Receivable` is only ever
**credited**, by `post_payment_settlement` when a payment is linked to an
invoice. There is no corresponding debit recorded anywhere when the
receivable is actually created. The ledger therefore has no receivable to
age: it cannot answer "how much is owed, since when, by which invoice,"
because it never recorded the invoice being issued in the first place.

Treating the ledger's `1100` balance as individually attributable to
specific invoices — which the brief explicitly warns against — would require
inventing an allocation this schema simply doesn't model.

### Accounts Payable Aging — deferred

`post_purchase_receipt` credits `2000 Accounts Payable` on every receipt,
but no RPC ever debits it back down for a Purchase — `vendor_payment` is a
reserved `source_type` in the `journal_entries` CHECK constraint with zero
current writers. Only the Expense accrual lifecycle
(`expense_due` credits `2000`, `expense_paid` debits it back — a clean,
fully-modeled, all-or-nothing settlement per expense, since
`record_expense_transition` has no partial-payment concept at all) has a
complete due-date/settlement model.

Reporting AP Aging from just the Expense-sourced subset of `2000` would
silently exclude every Purchase-driven payable and misrepresent total
Accounts Payable; reporting the full `2000` balance would require assuming a
due date and settlement behavior Purchases never modeled — exactly the kind
of invented assumption the brief prohibits ("If Purchase Receipts create AP
postings without a corresponding payable settlement-allocation model,
document the limitation rather than inventing one").

**Minimal future need:** either (a) a genuine vendor-bill/settlement-
allocation model for Purchases (a due date, and an RPC that debits `2000`
per payment against a specific receipt), or (b) an explicit product decision
to scope "AP Aging" to Expense Payables only, which is a business framing
choice, not an engineering one — deferred to that decision rather than made
unilaterally here.

## Files

- `src/types/financeReport.ts` — every domain type, including the three
  deferred reports' types (reserved, not yet returned by anything).
- `src/lib/data/finance/reportCalculations.ts` — shared pure helpers.
- `src/lib/data/finance/repository.ts` — `FinanceRepository` interface
  extension + filter types.
- `src/lib/data/finance/mockRepository.ts` /
  `src/lib/data/finance/supabaseRepository.ts` — the two implementations.
- `supabase/migrations/20260805100000_finance_report_rpcs.sql` — the four
  RPCs.
