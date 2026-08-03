import type { CreateProposalDraftInput, ProposalDraft } from "@/types/proposal";
import type { ProposalsRepository } from "@/lib/data/proposals/repository";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso, delay } from "@/lib/data/utils";

let proposals: ProposalDraft[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetProposalsStore(): void {
  proposals = [];
}

async function getProposalsByEvent(eventId: string): Promise<ProposalDraft[]> {
  await delay(100);
  return proposals.filter((proposal) => proposal.event_id === eventId).sort((a, b) => b.version - a.version);
}

async function getLatestProposalForEvent(eventId: string): Promise<ProposalDraft | null> {
  await delay(100);
  const chain = proposals.filter((proposal) => proposal.event_id === eventId);
  if (chain.length === 0) return null;
  return chain.reduce((latest, candidate) => (candidate.version > latest.version ? candidate : latest));
}

async function getProposalById(id: string): Promise<ProposalDraft | null> {
  await delay(100);
  return proposals.find((proposal) => proposal.id === id) ?? null;
}

async function getRecentProposals(workspaceId: string, limit: number): Promise<ProposalDraft[]> {
  await delay(100);
  return proposals
    .filter((proposal) => proposal.workspace_id === workspaceId)
    .sort((a, b) => b.generated_at.localeCompare(a.generated_at))
    .slice(0, limit);
}

/**
 * `version` always continues the Event's own chain (max existing version +
 * 1), independent of whether `parent_proposal_id` was passed — a fresh
 * "Generate" after a prior rejection still gets the next version number
 * rather than resetting to 1, since it's the same Event's history. Only
 * the referenced parent (if it's still `"draft"`) is flipped to
 * `"superseded"`; an already-accepted/rejected parent is left untouched —
 * regenerating never silently overturns a human decision.
 */
async function createProposalDraft(workspaceId: string, input: CreateProposalDraftInput): Promise<DataResult<ProposalDraft>> {
  const chain = proposals.filter((proposal) => proposal.event_id === input.event_id);
  const nextVersion = chain.length === 0 ? 1 : Math.max(...chain.map((proposal) => proposal.version)) + 1;

  if (input.parent_proposal_id) {
    const parent = proposals.find((proposal) => proposal.id === input.parent_proposal_id);
    if (!parent) return fail("The proposal being regenerated no longer exists.");
    if (parent.status === "draft") {
      proposals = proposals.map((proposal) => (proposal.id === parent.id ? { ...proposal, status: "superseded" as const } : proposal));
    }
  }

  const now = nowIso();
  const draft: ProposalDraft = {
    id: generateId("proposal"),
    workspace_id: workspaceId,
    event_id: input.event_id,
    client_id: input.client_id,
    status: "draft",
    version: nextVersion,
    parent_proposal_id: input.parent_proposal_id,
    executive_summary: input.executive_summary,
    event_overview: input.event_overview,
    services_included: input.services_included,
    timeline_summary: input.timeline_summary,
    pricing_summary: input.pricing_summary,
    payment_terms: input.payment_terms,
    recommendations: input.recommendations,
    optional_add_ons: input.optional_add_ons,
    questions_for_client: input.questions_for_client,
    ai_confidence: input.ai_confidence,
    missing_information: input.missing_information,
    provider: input.provider,
    model: input.model,
    prompt_version: input.prompt_version,
    mock: input.mock,
    generation_latency_ms: input.generation_latency_ms,
    generated_at: input.generated_at,
    reviewed_by: null,
    reviewed_at: null,
    created_at: now,
    updated_at: now,
  };
  proposals = [...proposals, draft];
  return ok(draft);
}

async function acceptProposal(id: string, actor: string): Promise<DataResult<ProposalDraft>> {
  const existing = proposals.find((proposal) => proposal.id === id);
  if (!existing) return fail("Proposal not found.");
  if (existing.status !== "draft") return fail("Only a draft proposal can be accepted.");

  const updated: ProposalDraft = { ...existing, status: "accepted", reviewed_by: actor, reviewed_at: nowIso(), updated_at: nowIso() };
  proposals = proposals.map((proposal) => (proposal.id === id ? updated : proposal));
  return ok(updated);
}

async function rejectProposal(id: string, actor: string): Promise<DataResult<ProposalDraft>> {
  const existing = proposals.find((proposal) => proposal.id === id);
  if (!existing) return fail("Proposal not found.");
  if (existing.status !== "draft") return fail("Only a draft proposal can be rejected.");

  const updated: ProposalDraft = { ...existing, status: "rejected", reviewed_by: actor, reviewed_at: nowIso(), updated_at: nowIso() };
  proposals = proposals.map((proposal) => (proposal.id === id ? updated : proposal));
  return ok(updated);
}

export const mockProposalsRepository: ProposalsRepository = {
  getProposalsByEvent,
  getLatestProposalForEvent,
  getProposalById,
  getRecentProposals,
  createProposalDraft,
  acceptProposal,
  rejectProposal,
};
