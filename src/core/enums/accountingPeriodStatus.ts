/** Mirrors accounting_periods_status_check exactly. Lifecycle is strictly open -> closed -> locked (see close_period/lock_period's own transition checks — a direct open -> locked call is rejected). */
export const ACCOUNTING_PERIOD_STATUSES = ["open", "closed", "locked"] as const;

export type AccountingPeriodStatus = (typeof ACCOUNTING_PERIOD_STATUSES)[number];

export const ACCOUNTING_PERIOD_STATUS_LABELS: Record<AccountingPeriodStatus, string> = {
  open: "Open",
  closed: "Closed",
  locked: "Locked",
};
