import type { Allocation, AllocationValidationResult, DependencyCheckResult, AllocationFinding, AllocationFindingSeverity, ResourceType } from "@/types/allocation";
import type { BundleCompletenessResult } from "@/core/allocation/bundleEngine";
import { resourceKey } from "@/core/allocation/resourcePoolEngine";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 27.1, Step 18 — Executive Integration's risk
 * detection half. Eight named, deterministic detectors over
 * already-computed data — no AI, no randomness, no new evaluation
 * logic; every detector calls into an engine this checkpoint already
 * built rather than re-implementing its logic.
 */

function risk(type: AllocationFinding["type"], severity: AllocationFindingSeverity, description: string, related: Partial<Pick<AllocationFinding, "relatedRequestId" | "relatedAllocationId" | "relatedResourceId">> = {}): AllocationFinding {
  return {
    id: generateId("allocation_finding"),
    type,
    severity,
    description,
    relatedRequestId: related.relatedRequestId ?? null,
    relatedAllocationId: related.relatedAllocationId ?? null,
    relatedResourceId: related.relatedResourceId ?? null,
  };
}

export interface DetectAllocationRisksInput {
  allocations: Allocation[];
  validationResultsByAllocationId: Map<string, AllocationValidationResult>;
  dependencyResultsByAllocationId: Map<string, DependencyCheckResult[]>;
  bundleCompletenessByAllocationId: Map<string, BundleCompletenessResult | null>;
  sharedResourceConflictCountByAllocationId: Map<string, number>;
  criticalResourceKeys: ReadonlySet<string>;
}

export function detectAllocationRisks(input: DetectAllocationRisksInput): AllocationFinding[] {
  const findings: AllocationFinding[] = [];

  // 1. Insufficient Resources / 7. No Allocation Possible
  for (const allocation of input.allocations) {
    const validation = input.validationResultsByAllocationId.get(allocation.id);
    const insufficientErrors = validation?.errors.filter((e) => e.rule === "insufficient_quantity") ?? [];
    if (insufficientErrors.length > 0) {
      findings.push(risk("insufficient_resources", "high", `Allocation is short on resources: ${insufficientErrors.map((e) => e.detail).join(" ")}`, { relatedRequestId: allocation.request_id, relatedAllocationId: allocation.id }));
    }
    if (allocation.candidates.filter((c) => c.selected).length === 0) {
      findings.push(risk("no_allocation_possible", "high", "No resource could be allocated at all for this request.", { relatedRequestId: allocation.request_id, relatedAllocationId: allocation.id }));
    }
  }

  // 2. Critical Dependency
  for (const [allocationId, results] of input.dependencyResultsByAllocationId) {
    const allocation = input.allocations.find((a) => a.id === allocationId);
    for (const result of results) {
      if (!result.satisfied) {
        findings.push(risk("critical_dependency", "high", `Unsatisfied dependency: ${result.rule.description}`, { relatedRequestId: allocation?.request_id ?? null, relatedAllocationId: allocationId }));
      }
    }
  }

  // 3. Bundle Incomplete
  for (const [allocationId, completeness] of input.bundleCompletenessByAllocationId) {
    if (completeness !== null && !completeness.isComplete) {
      const allocation = input.allocations.find((a) => a.id === allocationId);
      findings.push(risk("bundle_incomplete", "medium", `Bundle incomplete — ${completeness.missingRequiredLines.length} required line(s) missing.`, { relatedRequestId: allocation?.request_id ?? null, relatedAllocationId: allocationId }));
    }
  }

  // 4. Resource Bottleneck — a documented critical resource also in use across more than one active allocation.
  const usageCountByResource = new Map<string, number>();
  for (const allocation of input.allocations) {
    for (const candidate of allocation.candidates.filter((c) => c.selected)) {
      const key = resourceKey(candidate.resource_type, candidate.resource_id);
      usageCountByResource.set(key, (usageCountByResource.get(key) ?? 0) + 1);
    }
  }
  for (const key of input.criticalResourceKeys) {
    if ((usageCountByResource.get(key) ?? 0) > 1) {
      findings.push(risk("resource_bottleneck", "high", `Resource "${key}" is a single point of failure in use across multiple active allocations.`, { relatedResourceId: key }));
    }
  }

  // 5. Shared Resource Conflict
  for (const [allocationId, count] of input.sharedResourceConflictCountByAllocationId) {
    if (count > 0) {
      const allocation = input.allocations.find((a) => a.id === allocationId);
      findings.push(risk("shared_resource_conflict", "medium", `${count} shared-resource time conflict(s) detected for this allocation.`, { relatedRequestId: allocation?.request_id ?? null, relatedAllocationId: allocationId }));
    }
  }

  // 6. Fallback Activated
  for (const allocation of input.allocations) {
    const fallbacksUsed = allocation.candidates.filter((c) => c.selected && c.is_fallback);
    if (fallbacksUsed.length > 0) {
      findings.push(risk("fallback_activated", "low", `${fallbacksUsed.length} fallback resource(s) in use for this allocation.`, { relatedRequestId: allocation.request_id, relatedAllocationId: allocation.id }));
    }
  }

  // 8. Resource Shortage — a workspace-wide pattern: two or more distinct requests short on the same resource type, not an isolated case.
  const shortRequestIdsByType = new Map<ResourceType, Set<string>>();
  for (const allocation of input.allocations) {
    const validation = input.validationResultsByAllocationId.get(allocation.id);
    if (!validation?.errors.some((e) => e.rule === "insufficient_quantity")) continue;
    const shortTypes = new Set(allocation.candidates.filter((c) => !c.selected).map((c) => c.resource_type));
    for (const type of shortTypes) {
      if (!shortRequestIdsByType.has(type)) shortRequestIdsByType.set(type, new Set());
      shortRequestIdsByType.get(type)?.add(allocation.request_id);
    }
  }
  for (const [type, requestIds] of shortRequestIdsByType) {
    if (requestIds.size >= 2) {
      findings.push(risk("resource_shortage", "high", `${requestIds.size} active requests are short on ${type} resources — a workspace-wide shortage, not an isolated case.`));
    }
  }

  return findings;
}
