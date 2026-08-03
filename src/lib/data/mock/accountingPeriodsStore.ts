import type { AccountingPeriod } from "@/types/accountingPeriod";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/** One open period covering every existing Invoice/Payment/Expense seed date in this codebase (2026-06-01 through 2026-08-31, spanning the widest due_date/transaction_date range across lib/data/mock/*Store.ts) — enough for exercising create/close/lock transitions and posting a Journal Entry against any existing seed record without pre-seeding a period per month. */
const SEED_ACCOUNTING_PERIODS: AccountingPeriod[] = [
  {
    id: "accounting_period_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    period_start: "2026-06-01",
    period_end: "2026-08-31",
    status: "open",
    closed_at: null,
    closed_by: null,
    locked_at: null,
    locked_by: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  },
];

let accountingPeriods: AccountingPeriod[] = SEED_ACCOUNTING_PERIODS.map((period) => ({ ...period }));

export function readAccountingPeriods(): AccountingPeriod[] {
  return accountingPeriods;
}

export function writeAccountingPeriods(next: AccountingPeriod[]): void {
  accountingPeriods = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetAccountingPeriodsStore(): void {
  accountingPeriods = SEED_ACCOUNTING_PERIODS.map((period) => ({ ...period }));
}
