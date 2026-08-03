import type { PackageValidationResult, PackageHealthScores, PackageReadinessResult } from "@/types/executionPackage";

/**
 * v2.0 Checkpoint 27.3, Step 16 — Readiness Engine. Classifies a
 * package's already-computed validation + health into the single most
 * actionable state — never re-detects anything, only composes
 * `PackageValidationEngine`/`PackageHealthEngine`'s existing output.
 *
 * Precedence runs from the most fundamental prerequisite to the least:
 * a package can't meaningfully be "waiting on approval" if it has no
 * allocation at all yet, so `waiting_resources` outranks
 * `waiting_approval`. Each state maps to exactly one `PackageValidationEngine`
 * rule (or a small, disclosed group of them), so the reader always knows
 * which validation issue produced a given readiness state.
 */

const INCOMPLETE_HEALTH_THRESHOLD = 80;

export interface ReadinessInput {
  validation: PackageValidationResult;
  health: PackageHealthScores;
}

export function computePackageReadiness(input: ReadinessInput): PackageReadinessResult {
  const { validation, health } = input;
  const errorsOf = (rule: string) => validation.errors.filter((e) => e.rule === rule);
  const warningsOf = (rule: string) => validation.warnings.filter((w) => w.rule === rule);

  if (errorsOf("missing_allocation").length > 0) {
    return { state: "waiting_resources", reasons: errorsOf("missing_allocation").map((e) => e.detail) };
  }
  if (errorsOf("missing_schedule").length > 0) {
    return { state: "waiting_schedule", reasons: errorsOf("missing_schedule").map((e) => e.detail) };
  }
  if (errorsOf("broken_dependencies").length > 0 || warningsOf("capability_gap").length > 0) {
    return { state: "waiting_dependencies", reasons: [...errorsOf("broken_dependencies"), ...warningsOf("capability_gap")].map((i) => i.detail) };
  }
  if (errorsOf("missing_evidence").length > 0) {
    return { state: "waiting_evidence", reasons: errorsOf("missing_evidence").map((e) => e.detail) };
  }
  if (warningsOf("required_approvals").length > 0) {
    return { state: "waiting_approval", reasons: warningsOf("required_approvals").map((w) => w.detail) };
  }
  if (!validation.valid) {
    return { state: "blocked", reasons: validation.errors.map((e) => e.detail) };
  }
  if (validation.warnings.length > 0 || health.overallPackageHealth < INCOMPLETE_HEALTH_THRESHOLD) {
    const reasons = validation.warnings.length > 0 ? validation.warnings.map((w) => w.detail) : [`Overall package health is ${health.overallPackageHealth}/100.`];
    return { state: "incomplete", reasons };
  }
  return { state: "ready", reasons: [] };
}
