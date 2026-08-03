import type { ClientDocumentApproval, ClientDocumentApprovalStatus } from "@/types/clientDocumentApproval";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * Checkpoint 14 — a client's own approve/reject decision on a compiled
 * Document (Step 4's own "Approve (placeholder), Reject (placeholder)").
 * Mock-only, unconditionally, regardless of `NEXT_PUBLIC_DATA_MODE` — the
 * same precedent `core/workflow`/`core/automation`/`core/documents`/
 * `core/settings` already established for a checkpoint's own brand-new
 * domain (see each of those `manager.ts`'s own hardcoded
 * `mockXRepository` return, never reading the global data mode). A real
 * `client_document_approvals` table + RLS policy is written as a migration
 * (`supabase/migrations/`) for a future checkpoint to actually apply.
 */
let approvals: ClientDocumentApproval[] = [];

export function resetClientDocumentApprovalStore(): void {
  approvals = [];
}

export function getClientDocumentApproval(documentId: string, clientAccountId: string): ClientDocumentApproval | null {
  return approvals.find((approval) => approval.document_id === documentId && approval.client_account_id === clientAccountId) ?? null;
}

/** Checkpoint 15 — every Document approval decision in one Workspace, unscoped by client. Powers Document Analytics' own "Portal approvals" metric (Step 8). */
export function listClientDocumentApprovalsForWorkspace(workspaceId: string): ClientDocumentApproval[] {
  return approvals.filter((approval) => approval.workspace_id === workspaceId);
}

export function setClientDocumentApprovalStatus(
  workspaceId: string,
  documentId: string,
  clientAccountId: string,
  status: Exclude<ClientDocumentApprovalStatus, "pending">,
  comment: string | null,
): ClientDocumentApproval {
  const existing = getClientDocumentApproval(documentId, clientAccountId);
  const now = nowIso();
  const updated: ClientDocumentApproval = existing
    ? { ...existing, status, comment, decided_at: now, updated_at: now }
    : {
        id: generateId("client-document-approval"),
        workspace_id: workspaceId,
        document_id: documentId,
        client_account_id: clientAccountId,
        status,
        comment,
        decided_at: now,
        created_at: now,
        updated_at: now,
      };
  approvals = existing ? approvals.map((approval) => (approval.id === existing.id ? updated : approval)) : [...approvals, updated];
  return updated;
}
