import type { PostingStatus } from "@/core/enums/postingStatus";
import type { AccountType } from "@/core/enums/accountType";

/**
 * One line of a Journal Entry — always references a real chart_of_accounts
 * row via `account_id` (no polymorphic reference here, unlike
 * JournalEntry.source_type/source_id). Exactly one of `debit_minor`/
 * `credit_minor` is nonzero per the Posting Engine's own line-shape
 * invariant (enforced in Postgres, not re-validated here).
 *
 * `account` is populated only by getJournalEntry's detail fetch (a real
 * join against chart_of_accounts) — left undefined by any query that only
 * needs the raw line, so a caller can tell "not fetched" apart from "this
 * line truly has no account" (which never happens, since account_id is
 * NOT NULL, but the type still models the join as optional rather than
 * pretending it's always present).
 */
export interface JournalLine {
  id: string;
  journal_entry_id: string;
  workspace_id: string;
  account_id: string;
  debit_minor: number;
  credit_minor: number;
  currency: string;
  amount_in_base_currency_minor: number;
  line_memo: string | null;
  line_order: number;
  created_at: string;
  account?: {
    account_number: number;
    name: string;
    account_type: AccountType;
  };
}

/**
 * One Journal Entry — the ledger's unit of record. `source_type`/
 * `source_id` is a deliberate polymorphic reference to the operational
 * document that caused this entry (e.g. source_type='purchase_receipt',
 * source_id=<purchase_item_id>) — kept as plain `string`/`string | null`
 * rather than a strict union, since new source_types are added by future
 * Finance phases (Stripe) without this type needing to change.
 *
 * `posting_key` is the separate system-level idempotency identifier (see
 * the Posting Engine correction) — never a substitute for source_type/
 * source_id, and null for entries with no natural one-time key (Manual
 * Adjustments).
 *
 * `lines` is populated only by getJournalEntry (the detail fetch) —
 * listJournalEntries returns entries without their lines, matching every
 * other list/detail split already in this codebase (e.g. Purchase's
 * PurchaseItem list lives on the detail view, not the summary list).
 */
export interface JournalEntry {
  id: string;
  workspace_id: string;
  entry_date: string;
  accounting_period_id: string;
  source_type: string;
  source_id: string | null;
  posting_key: string | null;
  memo: string | null;
  currency: string;
  reversed_by_entry_id: string | null;
  reverses_entry_id: string | null;
  posting_status: PostingStatus;
  failure_reason: string | null;
  posted_by: string;
  created_at: string;
  lines?: JournalLine[];
}
