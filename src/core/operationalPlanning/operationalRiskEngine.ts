import type { OperationalPlan, OperationalValidationResult, OperationalHealthScores, OperationalFinding, OperationalFindingSeverity } from "@/types/operationalPlanning";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import { hasApprovalBottleneck } from "@/core/operationalPlanning/approvalEngine";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 27.2, Step 18 — Executive Integration's risk
 * detection half. Eight named, deterministic detectors over
 * already-computed data — no AI, no randomness, no new evaluation
 * logic; every detector calls into an engine this checkpoint already
 * built, or reuses a validation/health result the caller already
 * computed, rather than re-implementing its logic. `contextsWithoutPlan`
 * is the one input this pure engine cannot derive itself — knowing
 * which real Events/Clients have no operational plan at all requires
 * cross-referencing live Event/Client data, which
 * `operationalPlanningActions.ts` resolves and passes in.
 */

const INCOMPLETE_HEALTH_THRESHOLD = 60;
const HIGH_COMPLEXITY_THRESHOLD = 50;

function finding(type: OperationalFinding["type"], severity: OperationalFindingSeverity, description: string, related: Partial<Pick<OperationalFinding, "relatedPlanId" | "relatedStepId">> = {}): OperationalFinding {
  return { id: generateId("operational_finding"), type, severity, description, relatedPlanId: related.relatedPlanId ?? null, relatedStepId: related.relatedStepId ?? null };
}

export interface DetectOperationalRisksInput {
  plans: OperationalPlan[];
  validationResultsByPlanId: Map<string, OperationalValidationResult>;
  healthByPlanId: Map<string, OperationalHealthScores>;
  complexityByPlanId: Map<string, number>;
  /** Real context nodes (e.g. Events) with no `OperationalPlan` at all — resolved by the caller from live Event/Client data. */
  contextsWithoutPlan: KnowledgeNodeRef[];
}

export function detectOperationalRisks(input: DetectOperationalRisksInput): OperationalFinding[] {
  const findings: OperationalFinding[] = [];

  // 1. Missing Operational Plan
  for (const context of input.contextsWithoutPlan) {
    findings.push(finding("missing_operational_plan", "high", `"${context.nodeType}:${context.nodeId}" has no operational plan.`));
  }

  for (const plan of input.plans) {
    const validation = input.validationResultsByPlanId.get(plan.id);
    const health = input.healthByPlanId.get(plan.id);
    const complexity = input.complexityByPlanId.get(plan.id) ?? 0;

    // 2. Missing Evidence
    if (validation?.errors.some((e) => e.rule === "missing_evidence")) {
      findings.push(finding("missing_evidence", "medium", `"${plan.name}" has an evidence requirement that isn't attached to a real step or milestone.`, { relatedPlanId: plan.id }));
    }

    // 3. Missing Deliverables
    if (validation?.errors.some((e) => e.rule === "missing_deliverables")) {
      findings.push(finding("missing_deliverables", "medium", `"${plan.name}" has a deliverable that isn't attached to a real step.`, { relatedPlanId: plan.id }));
    }

    // 4. Approval Bottleneck
    if (hasApprovalBottleneck(plan.approvals)) {
      findings.push(finding("approval_bottleneck", "medium", `"${plan.name}" has multiple approvals pending at once.`, { relatedPlanId: plan.id }));
    }

    // 5. Critical Dependency
    if (validation?.errors.some((e) => e.rule === "broken_dependencies")) {
      findings.push(finding("critical_dependency", "high", `"${plan.name}" has a broken or circular step dependency.`, { relatedPlanId: plan.id }));
    }

    // 6. Incomplete Plan
    if (validation !== undefined && !validation.valid) {
      findings.push(finding("incomplete_plan", "high", `"${plan.name}" has blocking validation issues and cannot be approved as-is.`, { relatedPlanId: plan.id }));
    } else if (health !== undefined && health.overallOperationalHealth < INCOMPLETE_HEALTH_THRESHOLD) {
      findings.push(finding("incomplete_plan", "medium", `"${plan.name}" has low operational health (${health.overallOperationalHealth}/100).`, { relatedPlanId: plan.id }));
    }

    // 7. High Operational Complexity
    if (complexity >= HIGH_COMPLEXITY_THRESHOLD) {
      findings.push(finding("high_operational_complexity", "low", `"${plan.name}" has high execution complexity (${complexity}).`, { relatedPlanId: plan.id }));
    }

    // 8. Missing Checklist
    if (plan.checklists.length === 0 && (plan.status === "active" || plan.status === "approved")) {
      findings.push(finding("missing_checklist", "low", `"${plan.name}" is ${plan.status} but has no checklist attached.`, { relatedPlanId: plan.id }));
    }
  }

  return findings;
}
