"use server";

import { dispatchAutomationTrigger } from "@/core/automation/resolver";
import { registerAutomationDefinitions } from "@/modules/automation/registerAutomationDefinitions";
import { publishWebhookEvent } from "@/core/webhooks/publisher";
import { getLogger } from "@/core/observability/logger";
import { clockNow } from "@/core/time/clock";
import { getCurrentClientAccountContext } from "@/lib/data";
import type { AutomationTriggerType } from "@/types/automation";

// Registered once per process — same idempotent, call-on-load precedent every other Automation entry point uses (e.g. `acceptProposalDraft.ts`).
registerAutomationDefinitions();

/**
 * Checkpoint 14, Step 10 — "checklist completion / document download /
 * proposal view → Workflow Trigger, publish-only, never execute." These
 * three Server Actions are the Client Portal's only path into the
 * Automation Engine, and they never mutate anything themselves — each is
 * called only *after* the real, RLS/ownership-checked mutation (completing
 * a checklist item, issuing a signed download URL, reading an accepted
 * Proposal's summary) has already succeeded via the browser-safe
 * `@/lib/data` facade. Dispatching just reports that fact through the
 * exact same closed trigger channel `proposal.accepted`/`proposal.rejected`
 * already use — a Workflow only ever runs here if a staff member has
 * already designed and published it as a real Automation; nothing about
 * this file can create or run one.
 *
 * These live under `src/modules/clientPortal/` (not `src/lib/data/`)
 * deliberately: `@/lib/data/index.ts` is imported by nearly everything, and
 * `registerAutomationDefinitions()` transitively imports Action files that
 * themselves import `@/lib/data` — putting the dispatch call inside the
 * data facade would create a real circular import. A Server Action file
 * outside `lib/data` avoids that, the same reason `getClientPortalReceiptAction.ts`
 * exists as its own file.
 *
 * `workspaceId`/`clientId` are resolved here from `getCurrentClientAccountContext()` —
 * the same authenticated-session accessor every other file under
 * `src/modules/clientPortal/` uses — rather than trusted from caller-supplied
 * parameters. A caller-supplied workspace/client id would let any
 * authenticated caller fire a fabricated trigger (and thus any Automation a
 * workspace has configured on `checklist_item.completed`/`document.downloaded`/
 * `proposal.viewed`) into a workspace it has no relationship to; deriving
 * both ids from the resolved session closes that gap. A missing/invalid
 * session silently no-ops rather than throwing — dispatch is a best-effort
 * side effect of an already-completed action, never something the caller's
 * own flow should fail on.
 */
async function dispatchPortalTrigger(type: AutomationTriggerType, workspaceId: string, facts: Record<string, string | number | boolean | null>): Promise<void> {
  try {
    await dispatchAutomationTrigger(
      {
        type,
        workspaceId,
        occurredAt: clockNow().toISOString(),
        actorMemberId: null,
        facts,
      },
      { workspaceName: null, userId: null, userName: null, role: null, permissions: [] },
    );
  } catch (error) {
    getLogger().error(`Automation dispatch failed for ${type}`, { error: error instanceof Error ? error.message : "Unknown error" });
  }
}

export async function dispatchChecklistItemCompletedTrigger(checklistItemId: string, checklistItemTitle: string): Promise<void> {
  const context = await getCurrentClientAccountContext();
  if (!context) return;
  const { workspace_id: workspaceId, client_id: clientId } = context.account;

  await dispatchPortalTrigger("checklist_item.completed", workspaceId, { clientId, checklistItemId, checklistItemTitle });
  publishWebhookEvent({
    type: "checklist.completed",
    workspaceId,
    resource: { type: "checklist_item", id: checklistItemId },
    payload: { id: checklistItemId, title: checklistItemTitle, completed_at: clockNow().toISOString() },
  });
}

export async function dispatchDocumentDownloadedTrigger(documentId: string): Promise<void> {
  const context = await getCurrentClientAccountContext();
  if (!context) return;
  const { workspace_id: workspaceId, client_id: clientId } = context.account;

  await dispatchPortalTrigger("document.downloaded", workspaceId, { clientId, documentId });
  publishWebhookEvent({
    type: "document.downloaded",
    workspaceId,
    resource: { type: "document", id: documentId },
    payload: { document_id: documentId, client_account_id: clientId, occurred_at: clockNow().toISOString() },
  });
}

export async function dispatchProposalViewedTrigger(proposalId: string): Promise<void> {
  const context = await getCurrentClientAccountContext();
  if (!context) return;
  const { workspace_id: workspaceId, client_id: clientId } = context.account;

  await dispatchPortalTrigger("proposal.viewed", workspaceId, { clientId, proposalId });
  publishWebhookEvent({
    type: "proposal.viewed",
    workspaceId,
    resource: { type: "proposal", id: proposalId },
    payload: { proposal_id: proposalId, client_account_id: clientId, occurred_at: clockNow().toISOString() },
  });
}
