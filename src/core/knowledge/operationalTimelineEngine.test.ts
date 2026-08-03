import { describe, expect, it } from "vitest";
import { diffBusinessHealth, diffConstraintViolations, diffCriticalDependencies, diffReadiness } from "@/core/knowledge/operationalTimelineEngine";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { BusinessHealthReport, BusinessRuleViolation, ReadinessScore } from "@/types/businessHealth";
import type { ConstraintViolation, RelationshipConstraintRule } from "@/types/relationshipConstraints";

const NOW = "2026-07-30T00:00:00.000Z";

function makeHealthReport(overallScore: number): BusinessHealthReport {
  return { categories: [], overallScore, evaluatedAt: NOW };
}

function makeRule(overrides: Partial<RelationshipConstraintRule> & Pick<RelationshipConstraintRule, "id">): RelationshipConstraintRule {
  return {
    nodeType: "invoice",
    relationshipType: "belongs_to",
    direction: "outbound",
    counterpartNodeType: "proposal",
    requiredRole: null,
    minCount: 1,
    maxCount: 1,
    severity: "hard",
    description: "test rule",
    ...overrides,
  };
}

function makeViolation(overrides: Partial<ConstraintViolation> & Pick<ConstraintViolation, "constraint" | "node">): ConstraintViolation {
  return { actualCount: 0, message: "violated", ...overrides };
}

describe("diffBusinessHealth", () => {
  it("emits nothing when there is no prior snapshot", () => {
    const events = diffBusinessHealth("ws_1", null, makeHealthReport(80));
    expect(events).toEqual([]);
  });

  it("emits health_improved when the score rises", () => {
    const events = diffBusinessHealth("ws_1", { workspaceId: "ws_1", overallScore: 60, evaluatedAt: NOW }, makeHealthReport(80));
    expect(events).toEqual([{ type: "operational_health_improved", node: { nodeType: "workspace", nodeId: "ws_1" }, description: "Workspace health score changed from 60 to 80." }]);
  });

  it("emits health_declined when the score falls", () => {
    const events = diffBusinessHealth("ws_1", { workspaceId: "ws_1", overallScore: 80, evaluatedAt: NOW }, makeHealthReport(60));
    expect(events[0].type).toBe("operational_health_declined");
  });

  it("emits workspace_warning only when the score newly crosses below the threshold", () => {
    const crossing = diffBusinessHealth("ws_1", { workspaceId: "ws_1", overallScore: 55, evaluatedAt: NOW }, makeHealthReport(40));
    expect(crossing.some((e) => e.type === "operational_workspace_warning")).toBe(true);

    const stillLow = diffBusinessHealth("ws_1", { workspaceId: "ws_1", overallScore: 30, evaluatedAt: NOW }, makeHealthReport(20));
    expect(stillLow.some((e) => e.type === "operational_workspace_warning")).toBe(false);
  });

  it("emits nothing when the score is unchanged", () => {
    const events = diffBusinessHealth("ws_1", { workspaceId: "ws_1", overallScore: 80, evaluatedAt: NOW }, makeHealthReport(80));
    expect(events).toEqual([]);
  });
});

describe("diffReadiness", () => {
  const node: KnowledgeNodeRef = { nodeType: "proposal", nodeId: "proposal_1" };
  const readiness = (overallScore: number): ReadinessScore => ({ node, overallScore, missingRequirements: [], warnings: [], blockingIssues: [], suggestedNextSteps: [], lastEvaluatedAt: NOW });

  it("emits nothing when there is no prior snapshot", () => {
    expect(diffReadiness(null, readiness(80))).toEqual([]);
  });

  it("emits readiness_increased when the score rises", () => {
    const events = diffReadiness({ workspaceId: "ws_1", nodeType: "proposal", nodeId: "proposal_1", overallScore: 50, evaluatedAt: NOW }, readiness(80));
    expect(events[0].type).toBe("operational_readiness_increased");
  });

  it("emits readiness_decreased when the score falls", () => {
    const events = diffReadiness({ workspaceId: "ws_1", nodeType: "proposal", nodeId: "proposal_1", overallScore: 80, evaluatedAt: NOW }, readiness(50));
    expect(events[0].type).toBe("operational_readiness_decreased");
  });
});

describe("diffConstraintViolations", () => {
  it("emits constraint_violated for a newly-appearing violation", () => {
    const node: KnowledgeNodeRef = { nodeType: "invoice", nodeId: "invoice_1" };
    const violation = makeViolation({ constraint: makeRule({ id: "rule_1" }), node });
    const events = diffConstraintViolations([], [violation]);
    expect(events).toEqual([{ type: "operational_constraint_violated", node, description: "violated" }]);
  });

  it("emits constraint_fixed for a violation that no longer appears", () => {
    const node: KnowledgeNodeRef = { nodeType: "invoice", nodeId: "invoice_1" };
    const violation = makeViolation({ constraint: makeRule({ id: "rule_1" }), node });
    const events = diffConstraintViolations([violation], []);
    expect(events).toEqual([{ type: "operational_constraint_fixed", node, description: "Resolved: violated" }]);
  });

  it("emits nothing for a violation present in both", () => {
    const node: KnowledgeNodeRef = { nodeType: "invoice", nodeId: "invoice_1" };
    const violation = makeViolation({ constraint: makeRule({ id: "rule_1" }), node });
    expect(diffConstraintViolations([violation], [violation])).toEqual([]);
  });
});

describe("diffCriticalDependencies", () => {
  it("emits critical_dependency_detected for a newly-appearing circular_dependency violation", () => {
    const node: KnowledgeNodeRef = { nodeType: "media_folder", nodeId: "f1" };
    const violation: BusinessRuleViolation = { ruleId: "circular_dependency", description: "cycle detected", node, severity: "hard" };
    const events = diffCriticalDependencies([], [violation]);
    expect(events).toEqual([{ type: "operational_critical_dependency_detected", node, description: "cycle detected" }]);
  });

  it("ignores non-circular_dependency violations entirely", () => {
    const node: KnowledgeNodeRef = { nodeType: "invoice", nodeId: "invoice_1" };
    const violation: BusinessRuleViolation = { ruleId: "invoice_belongs_to_exactly_one_proposal", description: "missing proposal", node, severity: "hard" };
    expect(diffCriticalDependencies([], [violation])).toEqual([]);
  });

  it("does not re-emit a circular_dependency violation already present previously", () => {
    const node: KnowledgeNodeRef = { nodeType: "media_folder", nodeId: "f1" };
    const violation: BusinessRuleViolation = { ruleId: "circular_dependency", description: "cycle detected", node, severity: "hard" };
    expect(diffCriticalDependencies([violation], [violation])).toEqual([]);
  });
});
