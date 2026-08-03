/**
 * Live Event Mode (v2 Checkpoint 21, Step 2) needs a place to log the
 * handful of event-day actions that have no existing BloomOS entity to
 * reuse: Check In/Out, Report Issue, Request Help, and a generic
 * operational note. Every OTHER Live Event Mode action reuses something
 * that already exists rather than duplicating it here — "Complete Tasks"
 * writes to the real `ChecklistItem` (`completeChecklistItem`), "Upload
 * Photos/Videos" writes to the real `MediaAsset` system
 * (`uploadMediaAsset`), "Add Notes" writes to the real `Note` system
 * (`createEventNote`), and "Register Expenses" writes to the real
 * `Expense` ledger (`createExpense`). Only these four kinds are genuinely
 * new, staff-facing, event-day log entries.
 */

export const LIVE_EVENT_LOG_KINDS = ["check_in", "check_out", "issue_reported", "help_requested", "note"] as const;
export type LiveEventLogKind = (typeof LIVE_EVENT_LOG_KINDS)[number];

export const LIVE_EVENT_LOG_KIND_LABELS: Record<LiveEventLogKind, string> = {
  check_in: "Checked in",
  check_out: "Checked out",
  issue_reported: "Issue reported",
  help_requested: "Help requested",
  note: "Note",
};

export interface LiveEventLogEntry {
  id: string;
  workspace_id: string;
  event_id: string;
  kind: LiveEventLogKind;
  note: string | null;
  /** Free-text display name of the team member who logged this — same "no id-based Team Member FK yet" convention as Event.assigned_owner/ChecklistItem.assigned_name. */
  logged_by_name: string;
  occurred_at: string;
  created_at: string;
}

export interface LiveEventLogEntryInput {
  event_id: string;
  kind: LiveEventLogKind;
  note: string | null;
  logged_by_name: string;
}
