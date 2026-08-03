import { mockContractBuilderTemplatesRepository } from "@/lib/data/mock/contractBuilderTemplatesStore";
import { mockContractClausesRepository } from "@/lib/data/mock/contractClausesStore";
import { mockContractBuilderRepository } from "@/lib/data/mock/contractBuilderStore";

export type { ContractBuilderTemplatesRepository } from "@/lib/data/mock/contractBuilderTemplatesStore";
export type { ContractClausesRepository } from "@/lib/data/mock/contractClausesStore";
export type { ContractBuilderRepository } from "@/lib/data/mock/contractBuilderStore";

/** v2.0 Checkpoint 34 — Mock-only accessors, same precedent as every prior checkpoint's own `core/<domain>/index.ts`. No Supabase table exists yet for any of the 3 persisted entities this checkpoint owns (the real `Contract`/`ContractExhibit` tables are reused as-is, untouched). */
export function getCoreContractBuilderTemplatesService() {
  return mockContractBuilderTemplatesRepository;
}

export function getCoreContractClausesService() {
  return mockContractClausesRepository;
}

export function getCoreContractBuilderService() {
  return mockContractBuilderRepository;
}
