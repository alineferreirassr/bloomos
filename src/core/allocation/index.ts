import { mockAllocationRequestsRepository } from "@/lib/data/mock/allocationRequestsStore";
import { mockAllocationsRepository } from "@/lib/data/mock/allocationsStore";
import { mockResourceBundlesRepository } from "@/lib/data/mock/resourceBundlesStore";
import { mockDependencyRulesRepository } from "@/lib/data/mock/dependencyRulesStore";

export type { AllocationRequest, AllocationRequestContextType, AllocationRequirementLine } from "@/types/allocation";
export type { Allocation, AllocationCandidate, AllocationStatus, AllocationStrategy, AllocationSource, AllocationPriority } from "@/types/allocation";
export type { ResourceBundle, BundleResourceLine, BundleStatus } from "@/types/allocation";
export type { DependencyRule } from "@/types/allocation";
export type { ResourceType } from "@/types/allocation";

export type { CreateAllocationRequestInput, AllocationRequestsRepository } from "@/lib/data/mock/allocationRequestsStore";
export type { CreateAllocationInput, AllocationsRepository } from "@/lib/data/mock/allocationsStore";
export type { CreateResourceBundleInput, UpdateResourceBundleInput, ResourceBundlesRepository } from "@/lib/data/mock/resourceBundlesStore";
export type { CreateDependencyRuleInput, DependencyRulesRepository } from "@/lib/data/mock/dependencyRulesStore";

/** v2.0 Checkpoint 27.1 — Mock-only accessors, one per store, same precedent as `core/scheduling`/`core/capability`. No Supabase table exists yet for any Resource Allocation concept. */
export function getCoreAllocationRequestsService() {
  return mockAllocationRequestsRepository;
}

export function getCoreAllocationsService() {
  return mockAllocationsRepository;
}

export function getCoreResourceBundlesService() {
  return mockResourceBundlesRepository;
}

export function getCoreDependencyRulesService() {
  return mockDependencyRulesRepository;
}
