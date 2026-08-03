import type { ChartOfAccount } from "@/types/chartOfAccount";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const NOW = "2026-08-03T10:00:00.000Z";

/**
 * Mirrors the real seed exactly (see supabase/migrations/
 * 20260803101000_finance_seed_chart_of_accounts.sql) — same 41 accounts,
 * same account_number/name/account_type/normal_balance per row, so mock
 * mode gives realistic Chart of Accounts data for UI development without
 * needing a live database. IDs are deterministic (`account_<number>`), not
 * a random/hardcoded copy of any real seeded UUID.
 */
const SEED_ACCOUNTS: [number, string, ChartOfAccount["account_type"], ChartOfAccount["normal_balance"]][] = [
  [1000, "Cash", "asset", "debit"],
  [1010, "Stripe Clearing", "asset", "debit"],
  [1100, "Accounts Receivable", "asset", "debit"],
  [1200, "Inventory Asset", "asset", "debit"],
  [1300, "Prepaid Expenses", "asset", "debit"],
  [2000, "Accounts Payable", "liability", "credit"],
  [2100, "Sales Tax Payable", "liability", "credit"],
  [2200, "Customer Deposits / Unearned Revenue", "liability", "credit"],
  [3000, "Owner's Equity", "equity", "credit"],
  [3900, "Retained Earnings", "equity", "credit"],
  [4000, "Service Revenue", "revenue", "credit"],
  [4900, "Sales Discounts", "contra_revenue", "debit"],
  [4950, "Refunds & Returns", "contra_revenue", "debit"],
  [5000, "Cost of Goods Sold", "cost_of_goods_sold", "debit"],
  [5100, "Inventory Shrinkage / Write-off", "cost_of_goods_sold", "debit"],
  [6100, "Decor Expense", "operating_expense", "debit"],
  [6110, "Floral Expense", "operating_expense", "debit"],
  [6120, "Rental Expense", "operating_expense", "debit"],
  [6130, "Venue Expense", "operating_expense", "debit"],
  [6140, "Photography Expense", "operating_expense", "debit"],
  [6150, "Videography Expense", "operating_expense", "debit"],
  [6160, "Food & Beverage Expense", "operating_expense", "debit"],
  [6170, "Transportation Expense", "operating_expense", "debit"],
  [6180, "Printing Expense", "operating_expense", "debit"],
  [6190, "Supplies Expense", "operating_expense", "debit"],
  [6200, "Payroll Expense", "operating_expense", "debit"],
  [6210, "Supplier Payments (Non-PO)", "operating_expense", "debit"],
  [6220, "Marketing Expense", "operating_expense", "debit"],
  [6230, "Software & Subscriptions", "operating_expense", "debit"],
  [6240, "Insurance Expense", "operating_expense", "debit"],
  [6250, "Taxes & Licenses", "operating_expense", "debit"],
  [6260, "Bank & Processing Fees", "operating_expense", "debit"],
  [6270, "Travel Expense", "operating_expense", "debit"],
  [6280, "Employee Reimbursements", "operating_expense", "debit"],
  [6290, "Non-Inventory Purchase Items", "operating_expense", "debit"],
  [6900, "Miscellaneous Expense", "operating_expense", "debit"],
  [7000, "Interest Income", "other_income", "credit"],
  [7100, "Inventory Adjustment Gain", "other_income", "credit"],
  [7900, "Other Income", "other_income", "credit"],
  [8000, "Interest Expense", "other_expense", "debit"],
  [8900, "Other Expense", "other_expense", "debit"],
];

const SEED_CHART_OF_ACCOUNTS: ChartOfAccount[] = SEED_ACCOUNTS.map(([account_number, name, account_type, normal_balance]) => ({
  id: `account_${account_number}`,
  workspace_id: CURRENT_WORKSPACE_ID,
  account_number,
  name,
  account_type,
  normal_balance,
  parent_account_id: null,
  description: null,
  is_system: true,
  created_at: NOW,
  updated_at: NOW,
  archived_at: null,
}));

let chartOfAccounts: ChartOfAccount[] = SEED_CHART_OF_ACCOUNTS.map((account) => ({ ...account }));

export function readChartOfAccounts(): ChartOfAccount[] {
  return chartOfAccounts;
}

export function writeChartOfAccounts(next: ChartOfAccount[]): void {
  chartOfAccounts = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetChartOfAccountsStore(): void {
  chartOfAccounts = SEED_CHART_OF_ACCOUNTS.map((account) => ({ ...account }));
}
