import { mockProposalsRepository } from "@/lib/data/proposals/mockRepository";
import type { ProposalsRepository } from "@/lib/data/proposals/repository";

export type { ProposalsRepository } from "@/lib/data/proposals/repository";

/**
 * Deliberately always the mock repository, never routed through
 * `selectRepository()` — unlike every already-migrated business module
 * (Leads/Clients/Events/Contracts/Finance/Documents), Proposals has no real
 * `proposals` table yet, and `ProposalGeneratorPanel` is live-mounted on
 * every Event Detail page in this checkpoint. Inventory/Purchases/Services
 * shipped a throwing `supabaseRepository.ts` placeholder during their own
 * Foundation phase safely, because no UI called it yet; this feature's UI
 * calls `getLatestProposalForEvent` unconditionally on mount, so routing
 * through `selectRepository()` would crash the Proposal Generator on every
 * real Supabase-mode Workspace, not just a "no data yet" edge case — found
 * during this checkpoint's own live browser verification.
 * `supabaseProposalsRepository` (`supabaseRepository.ts`) still exists as
 * the scaffold a future Proposals migration phase will wire in here.
 */
export function getProposalsRepository(): ProposalsRepository {
  return mockProposalsRepository;
}
