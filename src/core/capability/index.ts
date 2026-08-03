import { mockCapabilityRequirementsRepository } from "@/lib/data/mock/capabilityRequirementsStore";

export type { CapabilityRequirement, CapabilityContextType, CapabilityCustomRule, CapabilityLocationRequirement } from "@/types/capability";
export type { CreateCapabilityRequirementInput, UpdateCapabilityRequirementInput, CapabilityRequirementFilters, CapabilityRequirementsRepository } from "@/lib/data/mock/capabilityRequirementsStore";

/** Mock-only accessor — no Supabase table exists yet, same precedent as `core/objectives`/`core/executiveDecisions`/`core/workforce`. */
export function getCoreCapabilityRequirementsService() {
  return mockCapabilityRequirementsRepository;
}
