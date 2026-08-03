import { describe, expect, it } from "vitest";
import { computeExecutiveInsights, type ExecutiveInsightsInput } from "@/core/executiveDecisions/executiveInsightsEngine";
import type { Decision } from "@/types/executiveDecisions";
import type { Objective, ObjectiveHealth } from "@/types/objectives";
import type { KnowledgeRelationship } from "@/types/knowledgeGraph";
import type { BusinessRuleViolation } from "@/types/businessHealth";

function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "decision_1",
    workspace_id: "ws_1",
    title: "x",
    description: "x",
    category: "operations",
    priority: "medium",
    status: "open",
    reason: "x",
    generated_by: "x",
    created_at: "2026-01-01T00:00:00.000Z",
    resolved_at: null,
    resolution_notes: null,
    related_entities: [],
    related_assets: [],
    related_objective_ids: [],
    related_timeline_activity_ids: [],
    dependencies: [],
    dedupe_key: "x",
    ...overrides,
  };
}

function makeRel(overrides: Partial<KnowledgeRelationship> & Pick<KnowledgeRelationship, "source_node_type" | "source_node_id" | "target_node_type" | "target_node_id" | "relationship_type">): KnowledgeRelationship {
  return {
    id: `rel_${Math.random()}`,
    workspace_id: "ws_1",
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    status: "active",
    confidence: 100,
    source: "user_action",
    notes: null,
    metadata: {},
    start_date: null,
    end_date: null,
    semantics: null,
    ...overrides,
  };
}

function makeObjective(overrides: Partial<Objective> = {}): Objective {
  return {
    id: "objective_1",
    workspace_id: "ws_1",
    scope: "event",
    node: { nodeType: "event", nodeId: "event_1" },
    title: "Event is fully ready",
    description: null,
    status: "blocked",
    requirements: [],
    dependencies: [],
    due_date: null,
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

function makeHealth(overrides: Partial<ObjectiveHealth> = {}): ObjectiveHealth {
  return { objectiveId: "objective_1", state: "blocked", effectiveStatus: "blocked", reasons: ["Unmet dependency"], recommendations: [], ...overrides };
}

const emptyInput: ExecutiveInsightsInput = { decisions: [], objectiveEvaluations: [], relationships: [], businessRuleViolations: [] };

describe("computeExecutiveInsights", () => {
  it("returns empty insights and a disclosed notApplicableReason for workflows given no data", () => {
    const insights = computeExecutiveInsights(emptyInput);
    expect(insights.mostImpactedClients).toEqual([]);
    expect(insights.mostFragileWorkflows.entries).toEqual([]);
    expect(insights.mostFragileWorkflows.notApplicableReason).toContain("workflow");
  });

  it("counts the most impacted clients from decisions' related_entities", () => {
    const decisions = [
      makeDecision({ id: "d1", related_entities: [{ nodeType: "client", nodeId: "client_1" }] }),
      makeDecision({ id: "d2", related_entities: [{ nodeType: "client", nodeId: "client_1" }] }),
      makeDecision({ id: "d3", related_entities: [{ nodeType: "client", nodeId: "client_2" }] }),
    ];
    const insights = computeExecutiveInsights({ ...emptyInput, decisions });
    expect(insights.mostImpactedClients[0]).toEqual({ node: { nodeType: "client", nodeId: "client_1" }, label: "client:client_1", count: 2 });
  });

  it("counts the most critical assets only from critical-priority decisions", () => {
    const decisions = [
      makeDecision({ id: "d1", priority: "critical", related_assets: [{ nodeType: "media_asset", nodeId: "asset_1" }] }),
      makeDecision({ id: "d2", priority: "low", related_assets: [{ nodeType: "media_asset", nodeId: "asset_2" }] }),
    ];
    const insights = computeExecutiveInsights({ ...emptyInput, decisions });
    expect(insights.mostCriticalAssets).toEqual([{ node: { nodeType: "media_asset", nodeId: "asset_1" }, label: "media_asset:asset_1", count: 1 }]);
  });

  it("counts most referenced documents from active relationships targeting a document", () => {
    const relationships = [
      makeRel({ source_node_type: "event", source_node_id: "event_1", target_node_type: "document", target_node_id: "doc_1", relationship_type: "used_by" }),
      makeRel({ source_node_type: "client", source_node_id: "client_1", target_node_type: "document", target_node_id: "doc_1", relationship_type: "used_by" }),
      makeRel({ source_node_type: "event", source_node_id: "event_1", target_node_type: "document", target_node_id: "doc_1", relationship_type: "used_by", status: "archived" }),
    ];
    const insights = computeExecutiveInsights({ ...emptyInput, relationships });
    expect(insights.mostReferencedDocuments).toEqual([{ node: { nodeType: "document", nodeId: "doc_1" }, label: "document:doc_1", count: 2 }]);
  });

  it("counts most violated business rules by ruleId", () => {
    const violations: BusinessRuleViolation[] = [
      { ruleId: "circular_dependency", description: "x", node: { nodeType: "event", nodeId: "event_1" }, severity: "hard" },
      { ruleId: "circular_dependency", description: "x", node: { nodeType: "event", nodeId: "event_2" }, severity: "hard" },
      { ruleId: "invalid_parent_folder", description: "x", node: { nodeType: "media_folder", nodeId: "f1" }, severity: "hard" },
    ];
    const insights = computeExecutiveInsights({ ...emptyInput, businessRuleViolations: violations });
    expect(insights.mostViolatedBusinessRules).toEqual([
      { ruleId: "circular_dependency", count: 2 },
      { ruleId: "invalid_parent_folder", count: 1 },
    ]);
  });

  it("lists only blocked objectives under mostBlockedObjectives", () => {
    const objectiveEvaluations = [
      { objective: makeObjective({ id: "o1", title: "Blocked one" }), health: makeHealth({ objectiveId: "o1", state: "blocked" }) },
      { objective: makeObjective({ id: "o2", title: "On track one" }), health: makeHealth({ objectiveId: "o2", state: "on_track" }) },
    ];
    const insights = computeExecutiveInsights({ ...emptyInput, objectiveEvaluations });
    expect(insights.mostBlockedObjectives).toHaveLength(1);
    expect(insights.mostBlockedObjectives[0].label).toBe("Blocked one");
  });

  it("respects a custom limit", () => {
    const decisions = ["c1", "c2", "c3"].map((id) => makeDecision({ id: `d_${id}`, related_entities: [{ nodeType: "client", nodeId: id }] }));
    const insights = computeExecutiveInsights({ ...emptyInput, decisions, limit: 2 });
    expect(insights.mostImpactedClients).toHaveLength(2);
  });
});
