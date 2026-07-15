import {
  DOCUMENT_STATUSES,
  TERMINAL_DOCUMENT_STATUSES,
  DOCUMENT_STATUS_LABELS,
  type DocumentStatus,
} from "@/core/enums/documentStatus";
import type { DocumentCategory } from "@/core/enums/documentCategory";

export { DOCUMENT_STATUSES, TERMINAL_DOCUMENT_STATUSES, DOCUMENT_STATUS_LABELS };
export type { DocumentStatus };

/**
 * The canonical Document lifecycle. Every non-`draft` value is reachable
 * only through its own dedicated data-layer action (activateDocument,
 * createDocumentVersion marks the prior latest version `superseded`,
 * expireDocument, archiveDocument, softDeleteDocument). Restoring an
 * archived or soft-deleted Document returns it to `active` — the same
 * "reasonable resumption point" precedent as restoreExpense/restoreContract,
 * chosen over `draft` because a Document that was previously active or
 * deleted already has complete metadata.
 */
const DOCUMENT_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ["active", "archived", "deleted"],
  active: ["superseded", "expired", "archived", "deleted"],
  superseded: ["archived", "deleted"],
  expired: ["archived", "deleted"],
  archived: ["active"],
  deleted: ["active"],
};

export function canTransitionDocumentStatus(from: DocumentStatus, to: DocumentStatus): boolean {
  if (from === to) return false;
  return DOCUMENT_TRANSITIONS[from].includes(to);
}

/** Every status `from` can legally move to right now. */
export function getNextDocumentStatuses(from: DocumentStatus): DocumentStatus[] {
  return DOCUMENT_TRANSITIONS[from];
}

/** True only for `deleted` — the one status with genuinely nothing left to do. `archived`/`expired`/`superseded` still surface a recommended action (see getDocumentNextRecommendedAction). */
export function isDocumentTerminal(status: DocumentStatus): boolean {
  return TERMINAL_DOCUMENT_STATUSES.includes(status);
}

interface DocumentForNextAction {
  status: DocumentStatus;
  category: DocumentCategory;
  folder_id: string | null;
  expires_at: string | null;
}

/** Shared with modules/documents/documentStats.ts so "expiring soon" means the same 14-day window everywhere it's surfaced. */
export const EXPIRING_SOON_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/** A draft counts as having incomplete metadata when it's still sitting in the fallback "other" category or hasn't been filed into a folder yet. */
function hasIncompleteDraftMetadata(document: DocumentForNextAction): boolean {
  return document.category === "other" || document.folder_id === null;
}

/**
 * Short, human-readable, deterministic suggestion for what to do next with
 * this Document — mirrors getExpenseNextRecommendedAction/
 * getInvoiceNextRecommendedAction. Only the terminal `deleted` status
 * returns null; every other status gets some guidance, even a "kept for
 * history" note on a superseded version.
 */
export function getDocumentNextRecommendedAction(document: DocumentForNextAction): string | null {
  if (isDocumentTerminal(document.status)) {
    return null;
  }

  switch (document.status) {
    case "draft":
      return hasIncompleteDraftMetadata(document)
        ? "Complete required metadata (category, folder) before activating this document"
        : "Activate this document";
    case "active": {
      if (document.expires_at === null) return null;
      const msUntilExpiry = new Date(document.expires_at).getTime() - Date.now();
      if (msUntilExpiry <= 0) return "This document has passed its expiration date — mark it expired";
      if (msUntilExpiry <= EXPIRING_SOON_WINDOW_MS) return "This document expires soon — review or renew it";
      return null;
    }
    case "superseded":
      return "A newer version exists — this version is kept for history only";
    case "expired":
      return "This document has expired — upload a new version or archive it";
    case "archived":
      return "Restore this document if it's needed again";
    default:
      return null;
  }
}
