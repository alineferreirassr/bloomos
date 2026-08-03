import { mockProposalTemplatesRepository } from "@/lib/data/mock/proposalTemplatesStore";
import { mockProposalPackagesRepository } from "@/lib/data/mock/proposalPackagesStore";
import { mockProposalAddonsRepository } from "@/lib/data/mock/proposalAddonsStore";
import { mockProposalBuilderRepository } from "@/lib/data/mock/proposalBuilderStore";

export type { ProposalTemplatesRepository } from "@/lib/data/mock/proposalTemplatesStore";
export type { ProposalPackagesRepository } from "@/lib/data/mock/proposalPackagesStore";
export type { ProposalAddonsRepository } from "@/lib/data/mock/proposalAddonsStore";
export type { ProposalBuilderRepository } from "@/lib/data/mock/proposalBuilderStore";

/** v2.0 Checkpoint 33 — Mock-only accessors, same precedent as every prior checkpoint's own `core/<domain>/index.ts`. No Supabase table exists yet for any of the four persisted entities this checkpoint owns. */
export function getCoreProposalTemplatesService() {
  return mockProposalTemplatesRepository;
}

export function getCoreProposalPackagesService() {
  return mockProposalPackagesRepository;
}

export function getCoreProposalAddonsService() {
  return mockProposalAddonsRepository;
}

export function getCoreProposalBuilderService() {
  return mockProposalBuilderRepository;
}
