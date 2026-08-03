"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getProposalsRepository } from "@/lib/data/proposals";
import { registerAutomationDefinitions } from "@/modules/automation/registerAutomationDefinitions";
import { dispatchAutomationTrigger } from "@/core/automation/resolver";
import { getLogger } from "@/core/observability/logger";
import { clockNow } from "@/core/time/clock";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import type { ProposalDraft } from "@/types/proposal";

const GENERIC_ACCESS_ERROR = "This proposal isn't available. It may not exist, or you may not have access to it.";

// Registered once per process — idempotent, mirrors every other Automation/AI entry point's own call-on-load.
registerAutomationDefinitions();

export type ReviewProposalDraftResult = { success: true; data: ProposalDraft } | { success: false; error: string };

/** The explicit human "no" path — always available alongside Accept, never inferred from inaction. */
export async function rejectProposalDraft(proposalId: string): Promise<ReviewProposalDraftResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }
  if (!session.permissions.includes("events.update")) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const result = await getProposalsRepository().rejectProposal(proposalId, session.user.id);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  // v2.0 Checkpoint 32 — Client Journey Timeline.
  recordTimelineActivity(session.workspace.id, "proposal", result.data.id, "proposal_declined", "Proposal declined", { eventId: result.data.event_id, clientId: result.data.client_id });

  // Checkpoint 9 — the Automation Engine's own real, live-wired trigger:
  // every actual Proposal rejection dispatches `proposal.rejected`, running
  // `recordMemoryOnProposalRejection`/`suggestFollowUpProposal` for real.
  // Never lets an Automation failure surface as a rejection failure — the
  // proposal is already rejected by the time this runs; a broken
  // Automation is this feature's own problem to log, not the caller's.
  try {
    await dispatchAutomationTrigger(
      {
        type: "proposal.rejected",
        workspaceId: session.workspace.id,
        occurredAt: clockNow().toISOString(),
        actorMemberId: session.membership.id,
        facts: {
          proposalId: result.data.id,
          eventId: result.data.event_id,
          clientId: result.data.client_id,
          proposalValueMinor: result.data.pricing_summary.subtotal_minor,
          title: "Proposal rejected",
          summary: `Proposal draft v${result.data.version} for Event ${result.data.event_id} was rejected.`,
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
    getLogger().error("Automation dispatch failed for proposal.rejected", { error: error instanceof Error ? error.message : "Unknown error" });
  }

  return { success: true, data: result.data };
}
