"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getClientById } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import { getCoreProposalBuilderService } from "@/core/proposalPlatform";
import { nowIso } from "@/lib/data/utils";
import { clientPortalRevisionRequestToRecommendations } from "@/core/clientPortal/clientPortalExecutiveIntegration";
import type { OperationalRecommendation } from "@/types/businessHealth";

/**
 * Checkpoint 36, Step 15 — Executive Decisions integration, the same
 * zero-arg, `[]`-on-no-session seam every other platform registers with
 * `executiveDecisionsActions.ts` (`contractRecommendationsForExecutiveDecisions`,
 * `proposalRecommendationsForExecutiveDecisions`, etc.) — this is the
 * Client Portal's own entry in that same list, never a parallel decision
 * pipeline. The only signal genuinely owned by the Portal (a client acting
 * through it, not the internal team) is a pending "Request Revision" on a
 * Proposal (Step 3) — `revision_requested_at` is real data the Proposal
 * Platform already stores; this reads it back rather than tracking a
 * second copy.
 */
export async function clientPortalRecommendationsForExecutiveDecisions(): Promise<OperationalRecommendation[]> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];

  const [proposals, builderStates] = await Promise.all([
    getProposalsRepository().getRecentProposals(session.workspace.id, 500),
    getCoreProposalBuilderService().listForWorkspace(session.workspace.id),
  ]);
  const byProposalId = new Map(builderStates.map((state) => [state.proposal_id, state]));
  const now = nowIso();

  const recommendations: OperationalRecommendation[] = [];
  for (const proposal of proposals) {
    const builderState = byProposalId.get(proposal.id);
    if (!builderState?.revision_requested_at) continue;

    const client = await getClientById(proposal.client_id).catch(() => null);
    recommendations.push(
      ...clientPortalRevisionRequestToRecommendations({
        proposalId: proposal.id,
        clientName: client ? `${client.first_name} ${client.last_name}`.trim() : "A client",
        revisionRequestedAt: builderState.revision_requested_at,
        now,
      }),
    );
  }
  return recommendations;
}
