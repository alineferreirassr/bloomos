/**
 * Mirrors the chart_of_accounts_account_type_check CHECK constraint exactly
 * (see supabase/migrations/20260803100000_finance_chart_of_accounts.sql) —
 * these 9 values are the full classification the Chart of Accounts was
 * seeded with in the Finance Event Matrix; nothing in this phase creates
 * new accounts, so this list only needs to stay in sync with what's
 * already committed, not anticipate future ones.
 */
export const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "contra_revenue",
  "cost_of_goods_sold",
  "operating_expense",
  "other_income",
  "other_expense",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  contra_revenue: "Contra Revenue",
  cost_of_goods_sold: "Cost of Goods Sold",
  operating_expense: "Operating Expense",
  other_income: "Other Income",
  other_expense: "Other Expense",
};
