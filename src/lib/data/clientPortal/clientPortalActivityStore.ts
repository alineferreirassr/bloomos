import type { ClientPortalActivity, ClientPortalActivityKind } from "@/types/clientPortalActivity";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * Checkpoint 14, Steps 1/3/14 — the Client Portal's own Activity log.
 * Mock-only, unconditionally, regardless of `NEXT_PUBLIC_DATA_MODE` — the
 * same "new checkpoint domain, mock-only this phase" precedent
 * `core/workflow`/`core/automation`/`core/documents`/`core/settings`
 * already established (see `clientDocumentApprovalStore.ts`'s own doc
 * comment for the full rationale). A real `client_portal_activities`
 * table + security-definer insert function is written as a migration
 * (`supabase/migrations/`) for a future checkpoint to actually apply.
 */
let activities: ClientPortalActivity[] = [];

export function resetClientPortalActivityStore(): void {
  activities = [];
}

export function logClientPortalActivity(workspaceId: string, clientAccountId: string, kind: ClientPortalActivityKind, entityId: string | null = null, entityLabel: string | null = null): void {
  activities = [
    ...activities,
    { id: generateId("client-portal-activity"), workspace_id: workspaceId, client_account_id: clientAccountId, kind, entity_id: entityId, entity_label: entityLabel, occurred_at: nowIso() },
  ];
}

export function listClientPortalActivity(workspaceId: string, clientAccountId: string, limit = 20): ClientPortalActivity[] {
  return activities
    .filter((activity) => activity.workspace_id === workspaceId && activity.client_account_id === clientAccountId)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, limit);
}

/** Checkpoint 15 — every client account's activity in one Workspace, unscoped by account. Powers Portal Analytics (Step 9) and Document Analytics' own Downloads/Views (Step 8), which both need a cross-client aggregate the per-account `listClientPortalActivity` above was never meant to answer. */
export function listClientPortalActivityForWorkspace(workspaceId: string, limit = 10000): ClientPortalActivity[] {
  return activities
    .filter((activity) => activity.workspace_id === workspaceId)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, limit);
}
