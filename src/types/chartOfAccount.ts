import type { AccountType } from "@/core/enums/accountType";
import type { NormalBalance } from "@/core/enums/normalBalance";

/**
 * One workspace-scoped Chart of Accounts row, seeded by the Finance
 * Database Schema phase (~34 accounts, see docs/finance-ledger.md) — this
 * phase only reads Chart of Accounts, it never creates or edits an
 * account, so there is no create/update input type here to match.
 *
 * `parent_account_id` supports a sub-account hierarchy (e.g. a specific
 * bank account under 1000 Cash) but nothing seeded today uses it — it's
 * nullable and read-only in this phase.
 */
export interface ChartOfAccount {
  id: string;
  workspace_id: string;
  account_number: number;
  name: string;
  account_type: AccountType;
  normal_balance: NormalBalance;
  parent_account_id: string | null;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
