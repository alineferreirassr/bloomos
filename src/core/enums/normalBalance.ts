/** Mirrors chart_of_accounts_normal_balance_check exactly — an account's normal_balance side, used to interpret whether a debit or credit increases its balance. */
export const NORMAL_BALANCES = ["debit", "credit"] as const;

export type NormalBalance = (typeof NORMAL_BALANCES)[number];

export const NORMAL_BALANCE_LABELS: Record<NormalBalance, string> = {
  debit: "Debit",
  credit: "Credit",
};
