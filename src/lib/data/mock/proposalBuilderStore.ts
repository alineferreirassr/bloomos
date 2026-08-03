import type { ProposalBuilderState, ProposalVersion, ProposalDocumentStatus } from "@/types/proposalPlatform";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 33 — the mutable shell around append-only `ProposalVersion`
 * history (see `types/proposalPlatform.ts`'s top-level doc comment for why
 * this is a new, additive companion to `ProposalDraft` rather than a
 * mutation of it). One `ProposalBuilderState` row per `proposal_id` —
 * `getOrCreateForProposal` is the only way a caller ever gets one, so a
 * missing row is never a distinct error case module callers need to
 * handle.
 */
let states: ProposalBuilderState[] = [];

export function resetProposalBuilderStore(): void {
  states = [];
}

async function getByProposalId(proposalId: string): Promise<ProposalBuilderState | null> {
  return states.find((s) => s.proposal_id === proposalId) ?? null;
}

async function getById(id: string): Promise<ProposalBuilderState | null> {
  return states.find((s) => s.id === id) ?? null;
}

async function getOrCreateForProposal(workspaceId: string, proposalId: string, actor: string): Promise<ProposalBuilderState> {
  const existing = states.find((s) => s.proposal_id === proposalId);
  if (existing) return existing;
  const now = nowIso();
  const created: ProposalBuilderState = {
    id: generateId("proposal_builder"),
    proposal_id: proposalId,
    workspace_id: workspaceId,
    status: "draft",
    current_version_id: null,
    versions: [],
    sent_at: null,
    sent_by: null,
    viewed_at: null,
    view_count: 0,
    favorited_by_client: false,
    revision_requested_at: null,
    revision_request_note: null,
    clientResponse: null,
    clientRespondedAt: null,
    archived_at: null,
    created_by: actor,
    created_at: now,
    updated_at: now,
  };
  states = [...states, created];
  return created;
}

async function listForWorkspace(workspaceId: string): Promise<ProposalBuilderState[]> {
  return states.filter((s) => s.workspace_id === workspaceId);
}

/** Append-only — never mutates or removes an existing `ProposalVersion`, only ever adds one and repoints `current_version_id`. */
async function appendVersion(proposalId: string, version: ProposalVersion, nextStatus: ProposalDocumentStatus): Promise<ProposalBuilderState | null> {
  const existing = states.find((s) => s.proposal_id === proposalId);
  if (!existing) return null;
  const updated: ProposalBuilderState = {
    ...existing,
    versions: [...existing.versions, version],
    current_version_id: version.id,
    status: nextStatus,
    updated_at: nowIso(),
  };
  states = states.map((s) => (s.proposal_id === proposalId ? updated : s));
  return updated;
}

async function setStatus(proposalId: string, status: ProposalDocumentStatus): Promise<ProposalBuilderState | null> {
  const existing = states.find((s) => s.proposal_id === proposalId);
  if (!existing) return null;
  const updated: ProposalBuilderState = { ...existing, status, archived_at: status === "archived" ? nowIso() : existing.archived_at, updated_at: nowIso() };
  states = states.map((s) => (s.proposal_id === proposalId ? updated : s));
  return updated;
}

/** Points `current_version_id` back at an earlier version — the version list itself is never trimmed or reordered, matching Step 8's "never overwrite previous versions." */
async function restoreVersion(proposalId: string, versionId: string): Promise<ProposalBuilderState | null> {
  const existing = states.find((s) => s.proposal_id === proposalId);
  if (!existing) return null;
  const target = existing.versions.find((v) => v.id === versionId);
  if (!target) return null;
  const updated: ProposalBuilderState = { ...existing, current_version_id: target.id, status: "revision", updated_at: nowIso() };
  states = states.map((s) => (s.proposal_id === proposalId ? updated : s));
  return updated;
}

async function markSent(proposalId: string, actor: string): Promise<ProposalBuilderState | null> {
  const existing = states.find((s) => s.proposal_id === proposalId);
  if (!existing) return null;
  const updated: ProposalBuilderState = { ...existing, sent_at: nowIso(), sent_by: actor, updated_at: nowIso() };
  states = states.map((s) => (s.proposal_id === proposalId ? updated : s));
  return updated;
}

/** Only the first view sets `viewed_at`; every view increments `view_count`. */
async function recordView(proposalId: string): Promise<ProposalBuilderState | null> {
  const existing = states.find((s) => s.proposal_id === proposalId);
  if (!existing) return null;
  const updated: ProposalBuilderState = { ...existing, viewed_at: existing.viewed_at ?? nowIso(), view_count: existing.view_count + 1, updated_at: nowIso() };
  states = states.map((s) => (s.proposal_id === proposalId ? updated : s));
  return updated;
}

async function setFavorited(proposalId: string, favorited: boolean): Promise<ProposalBuilderState | null> {
  const existing = states.find((s) => s.proposal_id === proposalId);
  if (!existing) return null;
  const updated: ProposalBuilderState = { ...existing, favorited_by_client: favorited, updated_at: nowIso() };
  states = states.map((s) => (s.proposal_id === proposalId ? updated : s));
  return updated;
}

async function requestRevision(proposalId: string, note: string): Promise<ProposalBuilderState | null> {
  const existing = states.find((s) => s.proposal_id === proposalId);
  if (!existing) return null;
  const updated: ProposalBuilderState = { ...existing, revision_requested_at: nowIso(), revision_request_note: note, status: "revision", updated_at: nowIso() };
  states = states.map((s) => (s.proposal_id === proposalId ? updated : s));
  return updated;
}

async function recordClientResponse(proposalId: string, response: "accepted" | "declined"): Promise<ProposalBuilderState | null> {
  const existing = states.find((s) => s.proposal_id === proposalId);
  if (!existing) return null;
  const updated: ProposalBuilderState = { ...existing, clientResponse: response, clientRespondedAt: nowIso(), updated_at: nowIso() };
  states = states.map((s) => (s.proposal_id === proposalId ? updated : s));
  return updated;
}

export interface ProposalBuilderRepository {
  getByProposalId: typeof getByProposalId;
  getById: typeof getById;
  getOrCreateForProposal: typeof getOrCreateForProposal;
  listForWorkspace: typeof listForWorkspace;
  appendVersion: typeof appendVersion;
  setStatus: typeof setStatus;
  restoreVersion: typeof restoreVersion;
  markSent: typeof markSent;
  recordView: typeof recordView;
  setFavorited: typeof setFavorited;
  requestRevision: typeof requestRevision;
  recordClientResponse: typeof recordClientResponse;
}

export const mockProposalBuilderRepository: ProposalBuilderRepository = {
  getByProposalId,
  getById,
  getOrCreateForProposal,
  listForWorkspace,
  appendVersion,
  setStatus,
  restoreVersion,
  markSent,
  recordView,
  setFavorited,
  requestRevision,
  recordClientResponse,
};
