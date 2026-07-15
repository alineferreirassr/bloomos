export const DOCUMENT_STATUSES = ["draft", "active", "superseded", "expired", "archived", "deleted"] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: "Draft",
  active: "Active",
  superseded: "Superseded",
  expired: "Expired",
  archived: "Archived",
  deleted: "Deleted",
};

/** Statuses reachable only through their own dedicated data-layer action (activateDocument, createDocumentVersion supersedes the prior latest version, expireDocument, archiveDocument, softDeleteDocument). `draft` is assigned outside a dedicated action (on createDocumentMetadata). */
export const LOCKED_DOCUMENT_STATUSES: DocumentStatus[] = ["active", "superseded", "expired", "archived", "deleted"];

/**
 * Only `deleted` is truly terminal (soft-deleted, nothing further to do —
 * BloomOS never physically deletes a Document record). `archived` remains
 * restorable via restoreDocument, and `expired`/`superseded` still surface a
 * recommended action (replace/reactivate, or "kept for version history"),
 * so none of those three short-circuit getDocumentNextRecommendedAction the
 * way a true terminal status would.
 */
export const TERMINAL_DOCUMENT_STATUSES: DocumentStatus[] = ["deleted"];
