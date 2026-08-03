import type { ProposalsRepository } from "@/lib/data/proposals/repository";

/**
 * No `proposals` table or migration exists yet (mock-only this phase, see
 * `repository.ts`'s doc comment) — every method throws rather than faking a
 * query against a table that doesn't exist, matching the same "throw, don't
 * pretend" placeholder every other Foundation-phase business domain shipped
 * before its own schema phase (Inventory, Purchases, Services).
 */
function notMigrated(): never {
  throw new Error("Proposals has not been migrated to Supabase yet — this phase is mock-only.");
}

export const supabaseProposalsRepository: ProposalsRepository = {
  getProposalsByEvent: () => notMigrated(),
  getLatestProposalForEvent: () => notMigrated(),
  getProposalById: () => notMigrated(),
  getRecentProposals: () => notMigrated(),
  createProposalDraft: () => notMigrated(),
  acceptProposal: () => notMigrated(),
  rejectProposal: () => notMigrated(),
};
