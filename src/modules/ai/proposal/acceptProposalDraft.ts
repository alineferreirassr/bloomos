"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getProposalsRepository } from "@/lib/data/proposals";
import { registerAutomationDefinitions } from "@/modules/automation/registerAutomationDefinitions";
import { dispatchAutomationTrigger } from "@/core/automation/resolver";
import { publishWebhookEvent } from "@/core/webhooks/publisher";
import { getLogger } from "@/core/observability/logger";
import { clockNow } from "@/core/time/clock";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import type { ProposalDraft } from "@/types/proposal";

const GENERIC_ACCESS_ERROR = "This proposal isn't available. It may not exist, or you may not have access to it.";

// Registered once per process — idempotent, mirrors every other Automation/AI entry point's own call-on-load.
registerAutomationDefinitions();

export type ReviewProposalDraftResult = { success: true; data: ProposalDraft } | { success: false; error: string };

/**
 * The only path a proposal ever leaves `"draft"` status for `"accepted"` —
 * always an explicit human action, never automatic, matching
 * `PRODUCT_PRINCIPLES.md` #4 and this use case's own
 * `humanApprovalPolicy: "always_required"`. The AI itself has no way to
 * call this — nothing in `generateProposalDraft.ts` ever does.
 */
export async function acceptProposalDraft(proposalId: string): Promise<ReviewProposalDraftResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }
  if (!session.permissions.includes("events.update")) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const result = await getProposalsRepository().acceptProposal(proposalId, session.user.id);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  // v2.0 Checkpoint 32 — Client Journey Timeline. First time Proposal
  // itself records a Timeline event; the Journey Timeline Adapter merges
  // it in against `ownerType: "proposal"` like every other module's own.
  recordTimelineActivity(session.workspace.id, "proposal", result.data.id, "proposal_accepted", "Proposal accepted", { eventId: result.data.event_id, clientId: result.data.client_id });

  // Checkpoint 9 — dispatches a real `proposal.accepted` trigger; no
  // Automation is currently registered against it (a future checkpoint's
  // own job), so this correctly fans out to nothing, proving the dispatch
  // mechanism is harmless when nothing is listening. Never lets an
  // Automation failure surface as an acceptance failure.
  try {
    await dispatchAutomationTrigger(
      {
        type: "proposal.accepted",
        workspaceId: session.workspace.id,
        occurredAt: clockNow().toISOString(),
        actorMemberId: session.membership.id,
        facts: {
          proposalId: result.data.id,
          eventId: result.data.event_id,
          clientId: result.data.client_id,
          proposalValueMinor: result.data.pricing_summary.subtotal_minor,
        },
      },
      {
        workspaceName: session.workspace.name,
        userId: session.user.id,
        userName: session.profile.full_name ?? null,
        role: session.membership.role,
        permissions: session.permissions,
      },
    );
  } catch (error) {
    getLogger().error("Automation dispatch failed for proposal.accepted", { error: error instanceof Error ? error.message : "Unknown error" });
  }

  publishWebhookEvent({
    type: "proposal.accepted",
    workspaceId: session.workspace.id,
    resource: { type: "proposal", id: result.data.id },
    payload: { id: result.data.id, event_id: result.data.event_id, status: result.data.status, accepted_at: result.data.reviewed_at },
  });

  return { success: true, data: result.data };
}
