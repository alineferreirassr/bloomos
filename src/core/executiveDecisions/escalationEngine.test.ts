import { describe, expect, it } from "vitest";
import { evaluateEscalation, shouldEscalate, type EscalationContext } from "@/core/executiveDecisions/escalationEngine";
import type { Decision } from "@/types/executiveDecisions";

function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "decision_1",
    workspace_id: "ws_1",
    title: "Resolve broken relationship",
    description: "x",
    category: "knowledge_graph",
    priority: "medium",
    status: "open",
    reason: "knowledge_health_engine:broken_relationship:rel_1",
    generated_by: "knowledge_health_engine",
    created_at: "2026-01-01T00:00:00.000Z",
    resolved_at: null,
    resolution_notes: null,
    related_entities: [],
    related_assets: [],
    related_objective_ids: [],
    related_timeline_activity_ids: [],
    dependencies: [],
    dedupe_key: "knowledge_health_engine:broken_relationship:rel_1",
    ...overrides,
  };
}

function makeContext(overrides: Partial<EscalationContext> = {}): EscalationContext {
  return { ageDays: 0, relatedObjectiveStatuses: [], unmetDependencyCount: 0, ...overrides };
}

describe("evaluateEscalation", () => {
  it("triggers critical_unresolved only when priority is critical and age meets the threshold", () => {
    const decision = makeDecision({ priority: "critical", generated_by: "business_health_engine", reason: "business_health_engine:x" });
    expect(shouldEscalate(decision, makeContext({ ageDays: 1 }))).toBe(false);
    expect(shouldEscalate(decision, makeContext({ ageDays: 3 }))).toBe(true);
  });

  it("does not trigger critical_unresolved for a lower-priority decision even at high age", () => {
    const decision = makeDecision({ priority: "medium" });
    const evaluations = evaluateEscalation(decision, makeContext({ ageDays: 30 }));
    expect(evaluations.find((e) => e.rule.id === "critical_unresolved")?.triggered).toBe(false);
  });

  it("triggers objective_blocked when any related objective is blocked", () => {
    const decision = makeDecision();
    expect(shouldEscalate(decision, makeContext({ relatedObjectiveStatuses: ["in_progress"] }))).toBe(false);
    expect(shouldEscalate(decision, makeContext({ relatedObjectiveStatuses: ["in_progress", "blocked"] }))).toBe(true);
  });

  it("triggers recurring_broken_relationship once the decision has survived past 1 day", () => {
    const decision = makeDecision({ reason: "knowledge_health_engine:broken_relationship:rel_1" });
    expect(shouldEscalate(decision, makeContext({ ageDays: 0 }))).toBe(false);
    expect(shouldEscalate(decision, makeContext({ ageDays: 1 }))).toBe(true);
  });

  it("triggers recurring_business_rule_violation only for business-rule-generated decisions", () => {
    const decision = makeDecision({ generated_by: "business_rule_engine", reason: "business_rule_engine:circular_dependency" });
    expect(shouldEscalate(decision, makeContext({ ageDays: 1 }))).toBe(true);

    const other = makeDecision({ generated_by: "business_health_engine", reason: "business_health_engine:proposal_completeness.hero_image" });
    const evaluations = evaluateEscalation(other, makeContext({ ageDays: 5 }));
    expect(evaluations.find((e) => e.rule.id === "recurring_business_rule_violation")?.triggered).toBe(false);
  });

  it("triggers recurring_dependency_failure only when there's an unmet dependency past the threshold", () => {
    const decision = makeDecision({ generated_by: "business_health_engine", reason: "business_health_engine:x" });
    expect(shouldEscalate(decision, makeContext({ ageDays: 2, unmetDependencyCount: 0 }))).toBe(false);
    expect(shouldEscalate(decision, makeContext({ ageDays: 2, unmetDependencyCount: 1 }))).toBe(true);
  });

  it("is deterministic and never escalates a fresh, low-priority, unblocked decision", () => {
    expect(shouldEscalate(makeDecision({ priority: "informational", generated_by: "business_health_engine", reason: "business_health_engine:x" }), makeContext())).toBe(false);
  });
});
