import { describe, expect, it } from "vitest";
import {
  deriveDecisionAgeDays,
  evaluateDecisionDependencies,
  validateDecisionStatusTransition,
  resolveDecisionReadiness,
  READINESS_NEUTRAL_FALLBACK,
  type DecisionDependencyContext,
  type ReadinessLookupContext,
} from "@/core/executiveDecisions/decisionEngine";
import { computePriority, type DecisionFactors } from "@/core/executiveDecisions/priorityEngine";
import type { Decision, DecisionDependency } from "@/types/executiveDecisions";
import type { BusinessRuleViolation } from "@/types/businessHealth";

function makeContext(overrides: Partial<DecisionDependencyContext> = {}): DecisionDependencyContext {
  return {
    decisionStatusById: new Map(),
    objectiveStatusById: new Map(),
    existingNodeKeys: new Set(),
    activeRelationshipIds: new Set(),
    existingTimelineActivityIds: new Set(),
    businessRuleViolations: [],
    approvalFlags: {},
    ...overrides,
  };
}

const baseDependency: DecisionDependency = {
  id: "dep_1",
  kind: "decision",
  description: "Depends on the Contract decision",
  targetDecisionId: "decision_2",
  targetObjectiveId: null,
  targetNode: null,
  businessRuleId: null,
  approvalKey: null,
  timelineActivityId: null,
};

describe("evaluateDecisionDependencies", () => {
  it("satisfies a decision dependency only when the target decision is resolved", () => {
    expect(evaluateDecisionDependencies([baseDependency], makeContext({ decisionStatusById: new Map([["decision_2", "in_progress"]]) }))[0].satisfied).toBe(false);
    expect(evaluateDecisionDependencies([baseDependency], makeContext({ decisionStatusById: new Map([["decision_2", "resolved"]]) }))[0].satisfied).toBe(true);
  });

  it("satisfies an objective dependency only when the target objective is completed", () => {
    const dep: DecisionDependency = { ...baseDependency, kind: "objective", targetDecisionId: null, targetObjectiveId: "objective_1" };
    expect(evaluateDecisionDependencies([dep], makeContext({ objectiveStatusById: new Map([["objective_1", "blocked"]]) }))[0].satisfied).toBe(false);
    expect(evaluateDecisionDependencies([dep], makeContext({ objectiveStatusById: new Map([["objective_1", "completed"]]) }))[0].satisfied).toBe(true);
  });

  it("satisfies a business_rule dependency only when no violation matches", () => {
    const dep: DecisionDependency = { ...baseDependency, kind: "business_rule", targetDecisionId: null, businessRuleId: "circular_dependency" };
    const violation: BusinessRuleViolation = { ruleId: "circular_dependency", description: "cycle", node: { nodeType: "event", nodeId: "event_1" }, severity: "hard" };
    expect(evaluateDecisionDependencies([dep], makeContext({ businessRuleViolations: [violation] }))[0].satisfied).toBe(false);
    expect(evaluateDecisionDependencies([dep], makeContext())[0].satisfied).toBe(true);
  });

  it("satisfies a relationship dependency only when the relationship id is still active", () => {
    const dep: DecisionDependency = { ...baseDependency, kind: "relationship", targetDecisionId: null, targetNode: { nodeType: "media_asset", nodeId: "rel_1" } };
    expect(evaluateDecisionDependencies([dep], makeContext())[0].satisfied).toBe(false);
    expect(evaluateDecisionDependencies([dep], makeContext({ activeRelationshipIds: new Set(["rel_1"]) }))[0].satisfied).toBe(true);
  });

  it("satisfies a timeline_activity dependency only when the activity id exists", () => {
    const dep: DecisionDependency = { ...baseDependency, kind: "timeline_activity", targetDecisionId: null, timelineActivityId: "activity_1" };
    expect(evaluateDecisionDependencies([dep], makeContext())[0].satisfied).toBe(false);
    expect(evaluateDecisionDependencies([dep], makeContext({ existingTimelineActivityIds: new Set(["activity_1"]) }))[0].satisfied).toBe(true);
  });

  it("satisfies a node-existence dependency (asset/event/client/document) via existingNodeKeys", () => {
    const dep: DecisionDependency = { ...baseDependency, kind: "client", targetDecisionId: null, targetNode: { nodeType: "client", nodeId: "client_1" } };
    expect(evaluateDecisionDependencies([dep], makeContext())[0].satisfied).toBe(false);
    expect(evaluateDecisionDependencies([dep], makeContext({ existingNodeKeys: new Set(["client:client_1"]) }))[0].satisfied).toBe(true);
  });

  it("satisfies an approval dependency from the resolved approvalFlags bag", () => {
    const dep: DecisionDependency = { ...baseDependency, kind: "approval", targetDecisionId: null, approvalKey: "contract_signed" };
    expect(evaluateDecisionDependencies([dep], makeContext())[0].satisfied).toBe(false);
    expect(evaluateDecisionDependencies([dep], makeContext({ approvalFlags: { contract_signed: true } }))[0].satisfied).toBe(true);
  });
});

describe("validateDecisionStatusTransition", () => {
  it("always allows non-resolved transitions", () => {
    const unmet = [{ dependency: baseDependency, satisfied: false, detail: "unmet" }];
    expect(validateDecisionStatusTransition("in_progress", unmet).allowed).toBe(true);
    expect(validateDecisionStatusTransition("escalated", unmet).allowed).toBe(true);
    expect(validateDecisionStatusTransition("archived", unmet).allowed).toBe(true);
  });

  it("blocks resolving a decision with an unmet dependency", () => {
    const unmet = [{ dependency: baseDependency, satisfied: false, detail: "unmet reason" }];
    const check = validateDecisionStatusTransition("resolved", unmet);
    expect(check.allowed).toBe(false);
    expect(check.blockingReasons).toEqual(["unmet reason"]);
  });

  it("allows resolving a decision with every dependency satisfied", () => {
    const met = [{ dependency: baseDependency, satisfied: true, detail: baseDependency.description }];
    expect(validateDecisionStatusTransition("resolved", met).allowed).toBe(true);
  });
});

describe("deriveDecisionAgeDays", () => {
  it("computes whole days elapsed", () => {
    expect(deriveDecisionAgeDays("2026-07-01T00:00:00.000Z", "2026-07-11T00:00:00.000Z")).toBe(10);
  });

  it("never returns a negative age", () => {
    expect(deriveDecisionAgeDays("2026-07-11T00:00:00.000Z", "2026-07-01T00:00:00.000Z")).toBe(0);
  });

  it("floors partial days", () => {
    expect(deriveDecisionAgeDays("2026-07-01T00:00:00.000Z", "2026-07-01T23:00:00.000Z")).toBe(0);
  });
});

function makeReadinessContext(overrides: Partial<ReadinessLookupContext> = {}): ReadinessLookupContext {
  return {
    proposalReadinessByNodeId: new Map(),
    eventReadinessByNodeId: new Map(),
    clientReadinessByNodeId: new Map(),
    vendorReadinessByNodeId: new Map(),
    objectiveProgressById: new Map(),
    businessHealthOverallScore: 70,
    ...overrides,
  };
}

function makeDecisionShape(overrides: Partial<Pick<Decision, "related_entities" | "related_objective_ids">> = {}): Pick<Decision, "related_entities" | "related_objective_ids"> {
  return { related_entities: [], related_objective_ids: [], ...overrides };
}

describe("resolveDecisionReadiness", () => {
  it("prefers entity-level readiness for a supported entity (proposal/event/client/vendor)", () => {
    const decision = makeDecisionShape({ related_entities: [{ nodeType: "proposal", nodeId: "proposal_1" }] });
    const resolution = resolveDecisionReadiness(decision, makeReadinessContext({ proposalReadinessByNodeId: new Map([["proposal_1", 30]]) }));
    expect(resolution).toEqual({ source: "proposal", value: 30, isFallback: false, priorityContribution: expect.any(Number) });
  });

  it("looks up event/client/vendor readiness the same way", () => {
    const eventDecision = makeDecisionShape({ related_entities: [{ nodeType: "event", nodeId: "event_1" }] });
    expect(resolveDecisionReadiness(eventDecision, makeReadinessContext({ eventReadinessByNodeId: new Map([["event_1", 55]]) })).source).toBe("event");

    const clientDecision = makeDecisionShape({ related_entities: [{ nodeType: "client", nodeId: "client_1" }] });
    expect(resolveDecisionReadiness(clientDecision, makeReadinessContext({ clientReadinessByNodeId: new Map([["client_1", 65]]) })).source).toBe("client");

    const vendorDecision = makeDecisionShape({ related_entities: [{ nodeType: "vendor", nodeId: "vendor_1" }] });
    expect(resolveDecisionReadiness(vendorDecision, makeReadinessContext({ vendorReadinessByNodeId: new Map([["vendor_1", 80]]) })).source).toBe("vendor");
  });

  it("falls back to Objective progress when related_objective_ids names a known objective", () => {
    const decision = makeDecisionShape({ related_entities: [{ nodeType: "media_asset", nodeId: "asset_1" }], related_objective_ids: ["objective_1"] });
    const resolution = resolveDecisionReadiness(decision, makeReadinessContext({ objectiveProgressById: new Map([["objective_1", 45]]) }));
    expect(resolution).toEqual({ source: "objective", value: 45, isFallback: false, priorityContribution: expect.any(Number) });
  });

  it("uses workspace-wide Business Health readiness for a workspace-scoped decision", () => {
    const noEntity = resolveDecisionReadiness(makeDecisionShape(), makeReadinessContext({ businessHealthOverallScore: 62 }));
    expect(noEntity).toEqual({ source: "workspace", value: 62, isFallback: false, priorityContribution: expect.any(Number) });

    const explicitWorkspaceNode = resolveDecisionReadiness(makeDecisionShape({ related_entities: [{ nodeType: "workspace", nodeId: "ws_1" }] }), makeReadinessContext({ businessHealthOverallScore: 62 }));
    expect(explicitWorkspaceNode.source).toBe("workspace");
  });

  it("uses the documented neutral fallback — never a silent 0 — for an unsupported entity with no objective link", () => {
    const decision = makeDecisionShape({ related_entities: [{ nodeType: "media_asset", nodeId: "asset_1" }] });
    const resolution = resolveDecisionReadiness(decision, makeReadinessContext());
    expect(resolution.source).toBe("fallback");
    expect(resolution.isFallback).toBe(true);
    expect(resolution.value).toBe(READINESS_NEUTRAL_FALLBACK);
    expect(resolution.value).not.toBe(0);
  });

  it("never returns a literal 0 fallback for any resolution path", () => {
    const decisions = [
      makeDecisionShape(),
      makeDecisionShape({ related_entities: [{ nodeType: "document", nodeId: "doc_1" }] }),
      makeDecisionShape({ related_entities: [{ nodeType: "contract", nodeId: "contract_1" }] }),
    ];
    for (const decision of decisions) {
      const resolution = resolveDecisionReadiness(decision, makeReadinessContext({ businessHealthOverallScore: 70 }));
      if (resolution.isFallback) expect(resolution.value).toBe(READINESS_NEUTRAL_FALLBACK);
    }
  });

  it("is deterministic — identical decision and context always resolve identically", () => {
    const decision = makeDecisionShape({ related_entities: [{ nodeType: "proposal", nodeId: "proposal_1" }] });
    const context = makeReadinessContext({ proposalReadinessByNodeId: new Map([["proposal_1", 40]]) });
    expect(resolveDecisionReadiness(decision, context)).toEqual(resolveDecisionReadiness(decision, context));
  });
});

describe("readiness scoring direction (integration with priorityEngine)", () => {
  function factorsWithReadiness(operationalReadiness: number | null): DecisionFactors {
    return { businessImpactCount: 0, dependencyCount: 0, unmetDependencyCount: 0, blockingRelationshipsCount: 0, operationalReadiness, objectiveBlocked: false, businessRuleSeverity: null, ageDays: 0, riskFlag: false };
  }

  it("low readiness increases priority relative to high readiness, all else equal", () => {
    const lowReadinessDecision = makeDecisionShape({ related_entities: [{ nodeType: "proposal", nodeId: "proposal_1" }] });
    const lowResolution = resolveDecisionReadiness(lowReadinessDecision, makeReadinessContext({ proposalReadinessByNodeId: new Map([["proposal_1", 5]]) }));
    const highResolution = resolveDecisionReadiness(lowReadinessDecision, makeReadinessContext({ proposalReadinessByNodeId: new Map([["proposal_1", 95]]) }));

    expect(lowResolution.priorityContribution).toBeGreaterThan(highResolution.priorityContribution);
    expect(computePriority(factorsWithReadiness(lowResolution.value))).not.toBe("informational");
  });

  it("high readiness reduces the readiness-driven priority contribution toward zero", () => {
    const resolution = resolveDecisionReadiness(makeDecisionShape({ related_entities: [{ nodeType: "event", nodeId: "event_1" }] }), makeReadinessContext({ eventReadinessByNodeId: new Map([["event_1", 100]]) }));
    expect(resolution.priorityContribution).toBe(0);
  });

  it("a fully unready (0) entity contributes the maximum readiness-gap points, capped", () => {
    const resolution = resolveDecisionReadiness(makeDecisionShape({ related_entities: [{ nodeType: "client", nodeId: "client_1" }] }), makeReadinessContext({ clientReadinessByNodeId: new Map([["client_1", 0]]) }));
    expect(resolution.priorityContribution).toBe(20); // WEIGHTS.readinessGapCap in priorityEngine.ts
  });
});
