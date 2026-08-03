import { getDocumentsManager } from "@/core/documents/manager";
import { blocksToPlainText } from "@/core/documents/exportPlainText";

export interface WorkspaceReceipt {
  id: string;
  invoiceId: string | null;
  clientId: string | null;
  title: string;
  text: string;
  compiledAt: string;
}

/**
 * Checkpoint 16, Step 5 — a workspace-wide Receipt reader. Checkpoint 14's
 * own `getClientPortalReceiptForInvoice` reads the same underlying source
 * (`getDocumentsManager().listComposedDocuments()` filtered to
 * `documentTypeId === "receipt"`, rendered via `blocksToPlainText()`) but
 * is hard-scoped to one client + one invoice, since a Client Portal
 * caller should only ever see their own. A Public API caller (a trusted,
 * Workspace-issued API Key) legitimately needs every Receipt in the
 * Workspace, optionally narrowed by `invoiceId`/`clientId` — this reuses
 * the exact same two primitives, never a new receipt-rendering path.
 */
export async function listWorkspaceReceipts(workspaceId: string, filters: { invoiceId?: string; clientId?: string } = {}): Promise<WorkspaceReceipt[]> {
  const documents = await getDocumentsManager().listComposedDocuments(workspaceId);
  return documents
    .filter((document) => document.documentTypeId === "receipt")
    .filter((document) => !filters.invoiceId || document.mergeContext.invoiceId === filters.invoiceId)
    .filter((document) => !filters.clientId || document.mergeContext.clientId === filters.clientId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((document) => ({
      id: document.id,
      invoiceId: document.mergeContext.invoiceId ?? null,
      clientId: document.mergeContext.clientId ?? null,
      title: document.metadata.title,
      text: blocksToPlainText(document.content),
      compiledAt: document.updatedAt,
    }));
}
