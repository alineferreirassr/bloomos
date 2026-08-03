import { describe, expect, it } from "vitest";
import { computeReadinessScore } from "@/core/knowledge/readinessEngine";
import type { KnowledgeRelationship, KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { CompletenessResult } from "@/types/businessHealth";

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

const NOW = "2026-07-30T00:00:00.000Z";

describe("computeReadinessScore", () => {
  it("scores a fully clean node with no completeness data at 100", () => {
    const node: KnowledgeNodeRef = { nodeType: "client", nodeId: "client_1" };
    const score = computeReadinessScore({ node, relationships: [], completeness: null, evaluatedAt: NOW });
    expect(score).toEqual({ node, overallScore: 100, missingRequirements: [], warnings: [], blockingIssues: [], suggestedNextSteps: [], lastEvaluatedAt: NOW });
  });

  it("applies a hard-violation penalty and surfaces it as a blocking issue", () => {
    const node: KnowledgeNodeRef = { nodeType: "invoice", nodeId: "invoice_1" };
    const score = computeReadinessScore({ node, relationships: [], completeness: null, evaluatedAt: NOW });
    expect(score.blockingIssues.length).toBe(1);
    expect(score.overallScore).toBe(80);
    expect(score.suggestedNextSteps.some((r) => r.ruleId === "invoice_belongs_to_exactly_one_proposal")).toBe(true);
  });

  it("applies a soft-violation penalty and surfaces it as a warning, not a blocking issue", () => {
    const node: KnowledgeNodeRef = { nodeType: "event", nodeId: "event_1" };
    const score = computeReadinessScore({ node, relationships: [], completeness: null, evaluatedAt: NOW });
    expect(score.blockingIssues).toEqual([]);
    expect(score.warnings.length).toBe(1);
    expect(score.overallScore).toBe(95);
  });

  it("folds in a pre-computed CompletenessResult's score and missing requirements", () => {
    const node: KnowledgeNodeRef = { nodeType: "proposal", nodeId: "proposal_1" };
    const relationships = [makeRel({ source_node_type: "proposal", source_node_id: "proposal_1", target_node_type: "client", target_node_id: "client_1", relationship_type: "belongs_to" })];
    const completeness: CompletenessResult = { missingRequirements: ["Missing Hero Image", "Missing Pricing"], score: 60 };
    const score = computeReadinessScore({ node, relationships, completeness, evaluatedAt: NOW });
    expect(score.missingRequirements).toEqual(["Missing Hero Image", "Missing Pricing"]);
    expect(score.overallScore).toBe(60);
    expect(score.suggestedNextSteps.some((r) => r.ruleId === "proposal_completeness.hero_image")).toBe(true);
  });

  it("never lets the score go below zero", () => {
    const node: KnowledgeNodeRef = { nodeType: "invoice", nodeId: "invoice_1" };
    const relationships = [
      makeRel({ source_node_type: "invoice", source_node_id: "invoice_1", target_node_type: "proposal", target_node_id: "proposal_1", relationship_type: "belongs_to" }),
      makeRel({ source_node_type: "invoice", source_node_id: "invoice_1", target_node_type: "proposal", target_node_id: "proposal_2", relationship_type: "belongs_to" }),
    ];
    const completeness: CompletenessResult = { missingRequirements: [], score: 10 };
    const score = computeReadinessScore({ node, relationships, completeness, evaluatedAt: NOW });
    expect(score.overallScore).toBe(0);
  });
});
