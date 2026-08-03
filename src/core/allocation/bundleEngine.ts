import type { ResourceBundle, AllocationRequirementLine, AllocationCandidate } from "@/types/allocation";

/**
 * v2.0 Checkpoint 27.1, Step 7 — Bundle Engine. A `ResourceBundle`
 * (e.g. "Photography Crew") is a reusable template — this engine only
 * ever translates one into `AllocationRequirementLine`s (required lines
 * first, then optional) and checks how completely a proposed
 * `Allocation`'s candidates fulfill it. It never selects a resource
 * itself — that's `AllocationEngine`'s job.
 */

/** Required lines occupy indices `[0, required_resources.length)`; optional lines follow immediately after — so a caller can always tell "was this line required" from its index alone, without re-consulting the bundle. */
export function buildRequirementLinesFromBundle(bundle: Pick<ResourceBundle, "required_resources" | "optional_resources">): AllocationRequirementLine[] {
  const toLine = (line: ResourceBundle["required_resources"][number]): AllocationRequirementLine => ({
    resource_type: line.resource_type,
    quantity: line.quantity,
    capability_requirement_id: line.capability_requirement_id,
    preferred_resource_ids: [],
    notes: line.notes,
  });
  return [...bundle.required_resources.map(toLine), ...bundle.optional_resources.map(toLine)];
}

export interface BundleCompletenessResult {
  requiredLineIndices: number[];
  optionalLineIndices: number[];
  fulfilledRequiredCount: number;
  fulfilledOptionalCount: number;
  isComplete: boolean;
  missingRequiredLines: number[];
}

export function evaluateBundleCompleteness(bundle: Pick<ResourceBundle, "required_resources" | "optional_resources">, candidates: AllocationCandidate[]): BundleCompletenessResult {
  const requiredCount = bundle.required_resources.length;
  const requiredLineIndices = bundle.required_resources.map((_, i) => i);
  const optionalLineIndices = bundle.optional_resources.map((_, i) => i + requiredCount);

  const missingRequiredLines: number[] = [];
  let fulfilledRequiredCount = 0;
  requiredLineIndices.forEach((lineIndex, i) => {
    const selectedCount = candidates.filter((c) => c.requirement_line_index === lineIndex && c.selected).length;
    if (selectedCount >= bundle.required_resources[i].quantity) fulfilledRequiredCount++;
    else missingRequiredLines.push(lineIndex);
  });

  let fulfilledOptionalCount = 0;
  optionalLineIndices.forEach((lineIndex, i) => {
    const selectedCount = candidates.filter((c) => c.requirement_line_index === lineIndex && c.selected).length;
    if (selectedCount >= bundle.optional_resources[i].quantity) fulfilledOptionalCount++;
  });

  return { requiredLineIndices, optionalLineIndices, fulfilledRequiredCount, fulfilledOptionalCount, isComplete: missingRequiredLines.length === 0, missingRequiredLines };
}

/** Vacuous 100 for a bundle with no required lines — same "not applicable resolves to a pass" discipline `capabilityScoreEngine.ts` established. */
export function computeBundleCompletenessScore(result: BundleCompletenessResult): number {
  if (result.requiredLineIndices.length === 0) return 100;
  return Math.round(100 * (result.fulfilledRequiredCount / result.requiredLineIndices.length));
}
