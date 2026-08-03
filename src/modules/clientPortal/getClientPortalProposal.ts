"use server";

import { getCurrentClientAccountContext } from "@/lib/data";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { buildProposalDetail } from "@/modules/proposalPlatform/proposalPlatformActions";
import { getProposalsRepository } from "@/lib/data/proposals";
import { getCoreProposalBuilderService } from "@/core/proposalPlatform";
import { compareProposalVersions } from "@/core/proposalPlatform/proposalComparisonEngine";
import { invalidateProposalCache } from "@/core/proposalPlatform/proposalCache";
import type { ProposalComparisonResult, ProposalPricing, ProposalSection } from "@/types/proposalPlatform";

/**
 * v2.0 Checkpoint 33, Step 14 — Client Proposal Experience. The same
 * two-session-mechanism split Checkpoint 32's `getClientPortalJourneySummary.ts`
 * established: this resolves a `ClientAccount` via `getCurrentClientAccountContext()`,
 * never the team-member session gate every other action in
 * `proposalPlatformActions.ts` uses, and reuses the exported
 * `buildProposalDetail` read model directly.
 *
 * A deliberately narrow, client-safe projection — never the raw
 * `ProposalDetail`. Health/readiness reasoning, internal notes, and every
 * other staff-only field stay server-side; only what a client needs to
 * review and respond to a proposal crosses this boundary.
 */

const GENERIC_ACCESS_ERROR = "The Dashboard isn't available. Please sign in again.";
const NOT_FOUND_ERROR = "This proposal could not be found.";

export interface ClientPortalProposalSummary {
  proposalId: string;
  title: string;
  heroHeadline: string;
  sections: ProposalSection[];
  pricing: ProposalPricing | null;
  terms: string | null;
  policies: string | null;
  currentVersionNumber: number | null;
  availableVersionNumbers: number[];
  favorited: boolean;
  clientResponse: "accepted" | "declined" | null;
  revisionRequestedAt: string | null;
}

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function resolveOwnedProposal(proposalId: string) {
  const context = await getCurrentClientAccountContext();
  if (!context) return { context: null, proposal: null } as const;
  const proposal = await getProposalsRepository().getProposalById(proposalId);
  if (!proposal || proposal.workspace_id !== context.account.workspace_id || proposal.client_id !== context.account.client_id) {
    return { context, proposal: null } as const;
  }
  return { context, proposal } as const;
}

/** Records the client's first-ever view (and every view thereafter) — the real trigger `proposal_document_viewed` needed and Checkpoint 32 didn't have yet. */
export async function getClientPortalProposalAction(proposalId: string): Promise<Result<ClientPortalProposalSummary>> {
  const { context, proposal } = await resolveOwnedProposal(proposalId);
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!proposal) return { success: false, error: NOT_FOUND_ERROR };

  const detail = await buildProposalDetail(context.account.workspace_id, proposalId);
  if (!detail || !detail.builderState || detail.builderState.sent_at === null) return { success: false, error: NOT_FOUND_ERROR };

  const updated = await getCoreProposalBuilderService().recordView(proposalId);
  if (updated && updated.view_count === 1) {
    recordTimelineActivity(context.account.workspace_id, "proposal", proposalId, "proposal_document_viewed", "Proposal viewed by client", { eventId: proposal.event_id, clientId: proposal.client_id });
    invalidateProposalCache(context.account.workspace_id);
  }

  const snapshot = detail.currentVersion?.snapshot ?? null;
  return {
    success: true,
    data: {
      proposalId,
      title: snapshot?.header.title ?? "Your Proposal",
      heroHeadline: snapshot?.hero.headline ?? "",
      sections: snapshot?.sections ?? [],
      pricing: snapshot?.pricing ?? null,
      terms: snapshot?.terms ?? null,
      policies: snapshot?.policies ?? null,
      currentVersionNumber: detail.currentVersion?.version_number ?? null,
      availableVersionNumbers: (updated ?? detail.builderState).versions.map((v) => v.version_number),
      favorited: (updated ?? detail.builderState).favorited_by_client,
      clientResponse: (updated ?? detail.builderState).clientResponse,
      revisionRequestedAt: (updated ?? detail.builderState).revision_requested_at,
    },
  };
}

export async function compareClientPortalProposalVersionsAction(proposalId: string, versionANumber: number, versionBNumber: number): Promise<Result<ProposalComparisonResult>> {
  const { context, proposal } = await resolveOwnedProposal(proposalId);
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!proposal) return { success: false, error: NOT_FOUND_ERROR };

  const state = await getCoreProposalBuilderService().getByProposalId(proposalId);
  if (!state) return { success: false, error: NOT_FOUND_ERROR };
  const versionA = state.versions.find((v) => v.version_number === versionANumber);
  const versionB = state.versions.find((v) => v.version_number === versionBNumber);
  if (!versionA || !versionB) return { success: false, error: "One or both versions could not be found." };

  return { success: true, data: compareProposalVersions(versionA, versionB) };
}

export async function requestProposalRevisionAction(proposalId: string, note: string): Promise<Result<null>> {
  const { context, proposal } = await resolveOwnedProposal(proposalId);
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!proposal) return { success: false, error: NOT_FOUND_ERROR };

  const updated = await getCoreProposalBuilderService().requestRevision(proposalId, note);
  if (!updated) return { success: false, error: NOT_FOUND_ERROR };

  recordTimelineActivity(context.account.workspace_id, "proposal", proposalId, "proposal_revision_requested", "Client requested a revision", { eventId: proposal.event_id, clientId: proposal.client_id });
  invalidateProposalCache(context.account.workspace_id);
  return { success: true, data: null };
}

/** The Client Portal's own "Accept Placeholder"/"Decline Placeholder" (Step 14) — records the client's intent only, never the real `ProposalDraft.status` transition (see this file's own doc comment and `types/proposalPlatform.ts`'s `ProposalBuilderState.clientResponse`). */
export async function submitClientProposalResponseAction(proposalId: string, response: "accepted" | "declined"): Promise<Result<null>> {
  const { context, proposal } = await resolveOwnedProposal(proposalId);
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!proposal) return { success: false, error: NOT_FOUND_ERROR };

  const updated = await getCoreProposalBuilderService().recordClientResponse(proposalId, response);
  if (!updated) return { success: false, error: NOT_FOUND_ERROR };

  recordTimelineActivity(context.account.workspace_id, "proposal", proposalId, "proposal_client_response_recorded", `Client indicated: ${response}`, { eventId: proposal.event_id, clientId: proposal.client_id });
  invalidateProposalCache(context.account.workspace_id);
  return { success: true, data: null };
}

export async function toggleFavoriteProposalAction(proposalId: string, favorited: boolean): Promise<Result<null>> {
  const { context, proposal } = await resolveOwnedProposal(proposalId);
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!proposal) return { success: false, error: NOT_FOUND_ERROR };

  const updated = await getCoreProposalBuilderService().setFavorited(proposalId, favorited);
  if (!updated) return { success: false, error: NOT_FOUND_ERROR };
  invalidateProposalCache(context.account.workspace_id);
  return { success: true, data: null };
}

export async function listClientPortalProposalsAction(): Promise<Result<Array<{ proposalId: string; title: string; grandTotal_minor: number | null; currency: string | null; sentAt: string | null }>>> {
  const context = await getCurrentClientAccountContext();
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };

  const states = await getCoreProposalBuilderService().listForWorkspace(context.account.workspace_id);
  const own = states.filter((s) => s.sent_at !== null);
  const results = await Promise.all(
    own.map(async (state) => {
      const proposal = await getProposalsRepository().getProposalById(state.proposal_id);
      if (!proposal || proposal.client_id !== context.account.client_id) return null;
      const version = state.versions.find((v) => v.id === state.current_version_id) ?? null;
      return {
        proposalId: state.proposal_id,
        title: version?.snapshot.header.title ?? "Your Proposal",
        grandTotal_minor: version?.snapshot.pricing.grandTotal_minor ?? null,
        currency: version?.snapshot.pricing.currency ?? null,
        sentAt: state.sent_at,
      };
    }),
  );

  return { success: true, data: results.filter((r): r is NonNullable<typeof r> => r !== null) };
}
