/**
 * Checkpoint 14, Step 4 — "Approve (placeholder), Reject (placeholder)."
 * A client's own sentiment on a compiled Document is a materially
 * different axis from the Document Platform's own `draft`/`published`/
 * `archived` lifecycle (`types/documentPlatform.ts`, Checkpoint 12) — it's
 * bolted on here as its own record rather than a new field on
 * `ComposedDocument`, so the Document Platform's own domain stays
 * untouched and this checkpoint never risks corrupting its lifecycle.
 * "Placeholder" per the spec's own wording: a real, working record of the
 * decision (status + optional comment + timestamp), but no downstream
 * business process (e.g. auto-triggering a re-draft on rejection) is
 * wired to it yet — that's a future checkpoint's own scope.
 */
export const CLIENT_DOCUMENT_APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type ClientDocumentApprovalStatus = (typeof CLIENT_DOCUMENT_APPROVAL_STATUSES)[number];

export interface ClientDocumentApproval {
  id: string;
  workspace_id: string;
  document_id: string;
  client_account_id: string;
  status: ClientDocumentApprovalStatus;
  comment: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}
