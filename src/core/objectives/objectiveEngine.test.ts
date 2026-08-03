import { describe, expect, it } from "vitest";
import { deriveEffectiveStatus, evaluateDependencies, validateStatusTransition, type DependencyContext } from "@/core/objectives/objectiveEngine";
import type { ObjectiveDependency, ObjectiveProgress } from "@/types/objectives";
import type { BusinessRuleViolation } from "@/types/businessHealth";

function makeContext(overrides: Partial<DependencyContext> = {}): DependencyContext {
  return {
    objectiveStatusById: new Map(),
    existingNodeKeys: new Set(),
    businessRuleViolations: [],
    approvalFlags: {},
    ...overrides,
  };
}

const baseDependency: ObjectiveDependency = {
  id: "dep_1",
  kind: "objective",
  description: "Depends on the Contract objective",
  targetObjectiveId: "objective_2",
  targetNode: null,
  businessRuleId: null,
  approvalKey: null,
};

describe("evaluateDependencies", () => {
  it("satisfies an objective dependency only when the target objective is completed", () => {
    const [unmet] = evaluateDependencies([baseDependency], makeContext({ objectiveStatusById: new Map([["objective_2", "in_progress"]]) }));
    expect(unmet.satisfied).toBe(false);

    const [met] = evaluateDependencies([baseDependency], makeContext({ objectiveStatusById: new Map([["objective_2", "completed"]]) }));
    expect(met.satisfied).toBe(true);
  });

  it("satisfies a business_rule dependency only when no violation matches", () => {
    const dependency: ObjectiveDependency = { ...baseDependency, kind: "business_rule", targetObjectiveId: null, businessRuleId: "circular_dependency" };
    const violation: BusinessRuleViolation = { ruleId: "circular_dependency", description: "cycle", node: { nodeType: "event", nodeId: "event_1" }, severity: "hard" };

    expect(evaluateDependencies([dependency], makeContext({ businessRuleViolations: [violation] }))[0].satisfied).toBe(false);
    expect(evaluateDependencies([dependency], makeContext())[0].satisfied).toBe(true);
  });

  it("satisfies an approval dependency from the resolved approvalFlags bag", () => {
    const dependency: ObjectiveDependency = { ...baseDependency, kind: "approval", targetObjectiveId: null, approvalKey: "contract_signed" };
    expect(evaluateDependencies([dependency], makeContext())[0].satisfied).toBe(false);
    expect(evaluateDependencies([dependency], makeContext({ approvalFlags: { contract_signed: true } }))[0].satisfied).toBe(true);
  });

  it("satisfies a node-existence dependency (event/asset/collection/client/knowledge_relationship) via existingNodeKeys", () => {
    const dependency: ObjectiveDependency = { ...baseDependency, kind: "event", targetObjectiveId: null, targetNode: { nodeType: "event", nodeId: "event_1" } };
    expect(evaluateDependencies([dependency], makeContext())[0].satisfied).toBe(false);
    expect(evaluateDependencies([dependency], makeContext({ existingNodeKeys: new Set(["event:event_1"]) }))[0].satisfied).toBe(true);
  });
});

describe("deriveEffectiveStatus", () => {
  const NOW = "2026-07-30T00:00:00.000Z";

  it("returns overdue when due_date has passed and status is still open", () => {
    expect(deriveEffectiveStatus({ status: "in_progress", due_date: "2026-07-01T00:00:00.000Z" }, NOW)).toBe("overdue");
  });

  it("does not return overdue when due_date is in the future", () => {
    expect(deriveEffectiveStatus({ status: "in_progress", due_date: "2026-08-01T00:00:00.000Z" }, NOW)).toBe("in_progress");
  });

  it("never overrides completed or archived, even past due_date", () => {
    expect(deriveEffectiveStatus({ status: "completed", due_date: "2026-01-01T00:00:00.000Z" }, NOW)).toBe("completed");
    expect(deriveEffectiveStatus({ status: "archived", due_date: "2026-01-01T00:00:00.000Z" }, NOW)).toBe("archived");
  });

  it("returns the stored status when there is no due_date", () => {
    expect(deriveEffectiveStatus({ status: "not_started", due_date: null }, NOW)).toBe("not_started");
  });
});

describe("validateStatusTransition", () => {
  const fullProgress: ObjectiveProgress = { objectiveId: "objective_1", completionPercent: 100, missingRequirements: [], blockingIssues: [], remainingTasks: [], estimatedProgress: 100 };
  const partialProgress: ObjectiveProgress = { objectiveId: "objective_1", completionPercent: 60, missingRequirements: ["x"], blockingIssues: [], remainingTasks: ["x"], estimatedProgress: 60 };

  it("always allows non-completed transitions", () => {
    expect(validateStatusTransition("blocked", partialProgress, []).allowed).toBe(true);
    expect(validateStatusTransition("in_progress", partialProgress, []).allowed).toBe(true);
    expect(validateStatusTransition("archived", partialProgress, []).allowed).toBe(true);
  });

  it("blocks completing an objective whose requirements aren't 100% met", () => {
    const check = validateStatusTransition("completed", partialProgress, []);
    expect(check.allowed).toBe(false);
    expect(check.blockingReasons).toEqual(["Completion is 60%, not 100%."]);
  });

  it("blocks completing an objective with an unmet dependency even at 100% completion", () => {
    const unmetDependency = { dependency: baseDependency, satisfied: false, detail: "Depends on the Contract objective (depends on an objective that is not yet completed.)" };
    const check = validateStatusTransition("completed", fullProgress, [unmetDependency]);
    expect(check.allowed).toBe(false);
  });

  it("allows completing an objective at 100% with every dependency satisfied", () => {
    const metDependency = { dependency: baseDependency, satisfied: true, detail: baseDependency.description };
    const check = validateStatusTransition("completed", fullProgress, [metDependency]);
    expect(check.allowed).toBe(true);
    expect(check.blockingReasons).toEqual([]);
  });
});
