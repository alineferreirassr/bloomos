/** Mirrors journal_entries_posting_status_check exactly. Every RPC in the Posting Engine inserts a Journal Entry directly as 'posted' — 'pending'/'failed' exist for the future Stripe async-webhook posting path, not produced by anything in this phase. A reversed entry keeps posting_status = 'posted'; reversal is tracked separately via reversed_by_entry_id, so 'reversed' is a reserved CHECK value with no current writer. */
export const POSTING_STATUSES = ["pending", "posted", "failed", "reversed"] as const;

export type PostingStatus = (typeof POSTING_STATUSES)[number];

export const POSTING_STATUS_LABELS: Record<PostingStatus, string> = {
  pending: "Pending",
  posted: "Posted",
  failed: "Failed",
  reversed: "Reversed",
};
