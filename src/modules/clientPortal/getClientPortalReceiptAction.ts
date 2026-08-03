"use server";

import { getInvoiceById, getCurrentClientAccountContext } from "@/lib/data";
import { getDocumentsManager } from "@/core/documents/manager";
import { blocksToPlainText } from "@/core/documents/exportPlainText";

const GENERIC_ACCESS_ERROR = "This receipt isn't available right now.";

export type GetClientPortalReceiptResult = { success: true; text: string | null } | { success: false; error: string };

/**
 * Checkpoint 14, Step 5 — "Expose: Receipts." Reuses the real Document
 * Platform (Checkpoint 12) directly rather than a duplicated receipt-
 * rendering path: this looks up an already-compiled `ComposedDocument` of
 * type `"receipt"` whose own `mergeContext.invoiceId` matches, and renders
 * it via the Document Platform's own `blocksToPlainText()` — the same
 * "NOT a PDF generator" plain-text export every other Document uses.
 * Deliberately never *compiles* a new receipt itself: a client viewing
 * their own Invoice has no reason to hold `documents.create`, and
 * generating a Document is an internal (or Automation-triggered) action
 * per the Document Platform's own model — this only ever reads what
 * already exists. `workspaceId`/`clientId` are resolved here from
 * `getCurrentClientAccountContext()` (hardened Checkpoint 45) rather than
 * trusted from a caller-supplied parameter, and the target Invoice is
 * still independently re-fetched with its own `client_id`/`workspace_id`
 * checked against that resolved context before anything is returned.
 */
export async function getClientPortalReceiptForInvoice(invoiceId: string): Promise<GetClientPortalReceiptResult> {
  const context = await getCurrentClientAccountContext();
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };
  const { workspace_id: workspaceId, client_id: clientId } = context.account;

  let invoice;
  try {
    invoice = await getInvoiceById(invoiceId);
  } catch {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }
  if (invoice.workspace_id !== workspaceId || invoice.client_id !== clientId) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const documents = await getDocumentsManager().listComposedDocuments(workspaceId);
  const receipts = documents
    .filter((document) => document.documentTypeId === "receipt" && document.mergeContext.invoiceId === invoiceId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const receipt = receipts[0];
  if (!receipt) return { success: true, text: null };
  return { success: true, text: blocksToPlainText(receipt.content) };
}
