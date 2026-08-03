import type { Worker } from "@/types/workforce";
import type { DependencyRule, DependencyCheckResult, ResourceType } from "@/types/allocation";
import { evaluateCertificationCapability, isCertificationStateBlocking } from "@/core/capability/certificationCapabilityEngine";

/**
 * v2.0 Checkpoint 27.1, Step 8 — Dependency Engine. Validates a
 * `DependencyRule` (e.g. "a Drone requires a certified operator") against
 * an allocation's already-selected worker candidates. Reuses
 * `certificationCapabilityEngine.ts`'s exact expiry/verification logic —
 * never re-implements what "does this worker actually hold a valid
 * certification" means.
 *
 * Scoped to worker-targeted dependencies only (`requires_resource_type:
 * "worker"`) — skill and certification are Worker-only concepts in this
 * codebase, so a rule naming any other `requires_resource_type` has
 * nothing meaningful to check here and is simply never matched. The
 * field stays generic in `types/allocation.ts` for a future checkpoint
 * that might define equipment-to-equipment or equipment-to-vehicle
 * dependencies; this engine deliberately doesn't fabricate that logic
 * now.
 */

function workerSatisfiesRule(worker: Pick<Worker, "id" | "skills" | "certifications">, rule: DependencyRule, now: string): boolean {
  if (rule.requires_skill !== null && !worker.skills.some((s) => s.name === rule.requires_skill)) return false;
  if (rule.requires_certification !== null) {
    const result = evaluateCertificationCapability(rule.requires_certification, worker.certifications, now, null);
    if (isCertificationStateBlocking(result.state)) return false;
  }
  return true;
}

/** Rules that apply to a candidate resource — matched by `subject_resource_type` and, when set, `subject_identifier` (e.g. an Equipment `category`). A `null` `subject_identifier` on the rule means "every resource of this type." */
export function findApplicableRules(rules: DependencyRule[], subjectResourceType: ResourceType, subjectIdentifier: string | null): DependencyRule[] {
  return rules.filter((r) => r.subject_resource_type === subjectResourceType && r.requires_resource_type === "worker" && (r.subject_identifier === null || r.subject_identifier === subjectIdentifier));
}

export interface CheckDependenciesInput {
  rules: DependencyRule[];
  subjectResourceType: ResourceType;
  subjectIdentifier: string | null;
  /** Every worker already selected as a candidate elsewhere in the same allocation — a dependency is satisfied by co-allocation, never by a worker outside the proposal. */
  selectedWorkers: Array<Pick<Worker, "id" | "skills" | "certifications">>;
  now: string;
}

export function checkDependencies(input: CheckDependenciesInput): DependencyCheckResult[] {
  const applicable = findApplicableRules(input.rules, input.subjectResourceType, input.subjectIdentifier);
  return applicable.map((rule) => {
    const satisfyingWorker = input.selectedWorkers.find((w) => workerSatisfiesRule(w, rule, input.now));
    return { rule, satisfied: satisfyingWorker !== undefined, satisfiedByResourceId: satisfyingWorker?.id ?? null };
  });
}

export function allDependenciesSatisfied(results: DependencyCheckResult[]): boolean {
  return results.every((r) => r.satisfied);
}
