import type { CreateProposalDraftInput, ProposalDraft } from "@/types/proposal";
import type { DataResult } from "@/lib/data/result";

/**
 * Mock-only persistence this phase (no migration) — same precedent as every
 * other Foundation-phase business domain (`purchase`, `inventory_item`)
 * before its own schema phase shipped a table, combined with the v2
 * standing rule against schema changes without a verified release blocker.
 * `createProposalDraft` covers both "Generate" (no `parent_proposal_id`) and
 * "Regenerate" (chain continues) — the caller decides which by what it
 * passes in, mirroring `Document`'s version-chain shape.
 */
export interface ProposalsRepository {
  getProposalsByEvent(eventId: string): Promise<ProposalDraft[]>;
  getLatestProposalForEvent(eventId: string): Promise<ProposalDraft | null>;
  getProposalById(id: string): Promise<ProposalDraft | null>;
  /** Every proposal in this Workspace (across all Events), newest-generated first, capped at `limit` — powers the Bloom AI landing page's Recent Activity/Usage Statistics, not any per-Event flow. */
  getRecentProposals(workspaceId: string, limit: number): Promise<ProposalDraft[]>;
  createProposalDraft(workspaceId: string, input: CreateProposalDraftInput): Promise<DataResult<ProposalDraft>>;
  /** Marks every other `"draft"` version in this Event's chain `"superseded"` too, so only the newest draft and the one accepted version (if any) are ever active at once. */
  acceptProposal(id: string, actor: string): Promise<DataResult<ProposalDraft>>;
  rejectProposal(id: string, actor: string): Promise<DataResult<ProposalDraft>>;
}
