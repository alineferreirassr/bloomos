"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getProposalsRepository } from "@/lib/data/proposals";
import type { ProposalDraft } from "@/types/proposal";

const GENERIC_ACCESS_ERROR = "This proposal isn't available. It may not exist, or you may not have access to it.";

export type GetLatestProposalResult = { success: true; data: ProposalDraft | null } | { success: false; error: string };

/** Lets `ProposalGeneratorPanel` show the most recent draft on mount/reload rather than always starting blank — read-only, gated the same way generation is (`events.update`). */
export async function getLatestProposalForEvent(eventId: string): Promise<GetLatestProposalResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }
  if (!session.permissions.includes("events.update")) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const proposal = await getProposalsRepository().getLatestProposalForEvent(eventId);
  return { success: true, data: proposal };
}
