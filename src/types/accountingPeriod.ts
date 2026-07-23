import type { AccountingPeriodStatus } from "@/core/enums/accountingPeriodStatus";

/** One workspace-scoped accounting period. Lifecycle: open -> closed -> locked (see create_accounting_period/close_period/lock_period's own transition rules — this phase never auto-creates a period). */
export interface AccountingPeriod {
  id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  status: AccountingPeriodStatus;
  closed_at: string | null;
  closed_by: string | null;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
  updated_at: string;
}
