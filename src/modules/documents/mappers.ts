import type { Document } from "@/types/document";
import type { DocumentEditMetadataFormInput, DocumentMetadataFormInput } from "@/modules/documents/schema";
import { formatDateOnly } from "@/lib/dateFormat";

const BYTES_PER_MB = 1024 * 1024;

/** Converts an integer byte count into the plain-string megabyte value the size form field works with (2_097_152 -> "2"). */
export function bytesToMbFormString(sizeBytes: number): string {
  return String(Math.round((sizeBytes / BYTES_PER_MB) * 100) / 100);
}

/** Formats a byte count for display — formatBytes(2_097_152) => "2.0 MB", formatBytes(512) => "512 B". Pinned to "en-US" like lib/money.ts's formatMoney, so the thousands separator doesn't shift with the viewer's browser locale. */
export function formatBytes(sizeBytes: number): string {
  if (sizeBytes < BYTES_PER_MB) return `${sizeBytes.toLocaleString("en-US")} B`;
  return `${(sizeBytes / BYTES_PER_MB).toFixed(1)} MB`;
}

/**
 * Formats a Document date field for display — unlike Event's `event_date`,
 * `expires_at`/`archived_at`/`deleted_at` may be either a plain "YYYY-MM-DD"
 * string (from the expiration-date form input) or a full ISO timestamp
 * (seed data, or any *_at set by the data layer), so this always takes just
 * the date portion before formatting rather than assuming one shape like
 * modules/events/dateFormat.ts's formatEventDate does.
 *
 * Re-exported under this module's name so existing `formatDocumentDate`
 * imports don't need to change — see `@/lib/dateFormat` for the shared
 * implementation.
 */
export const formatDocumentDate = formatDateOnly;

/** Prefills the "Add Document" form when arriving from a Client/Event/Contract/etc.'s "Add Document Metadata" quick action. */
export function documentDefaultFormValues(
  overrides: Partial<DocumentMetadataFormInput> = {},
): DocumentMetadataFormInput {
  return {
    owner_type: "workspace",
    owner_id: "",
    folder_id: "",
    title: "",
    description: "",
    category: "other",
    visibility: "internal",
    expires_at: "",
    contract_exhibit_id: "",
    event_id: "",
    client_id: "",
    contract_id: "",
    invoice_id: "",
    payment_id: "",
    expense_id: "",
    ...overrides,
  };
}

/** Converts a Document record's editable-metadata fields into the plain-string shape the edit form works with. */
export function documentToEditMetadataFormInput(document: Document): DocumentEditMetadataFormInput {
  return {
    title: document.title,
    description: document.description ?? "",
    category: document.category,
    expires_at: document.expires_at ? document.expires_at.slice(0, 10) : "",
  };
}
