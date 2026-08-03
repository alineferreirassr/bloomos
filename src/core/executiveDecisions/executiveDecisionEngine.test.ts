import { describe, expect, it } from "vitest";
import { generateDecisionDrafts, type GenerateDecisionDraftsInput } from "@/core/executiveDecisions/executiveDecisionEngine";
import { makeDocument } from "@/modules/documents/testUtils";
import type { KnowledgeRelationship } from "@/types/knowledgeGraph";
import type { OperationalRecommendation } from "@/types/businessHealth";

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

const emptyInput: GenerateDecisionDraftsInput = { recommendationSources: [], brokenRelationships: [], duplicateRelationshipGroups: [], circularReferenceGroups: [], expiredDocuments: [] };

describe("generateDecisionDrafts", () => {
  it("returns nothing for a workspace with no signals", () => {
    expect(generateDecisionDrafts(emptyInput)).toEqual([]);
  });

  it("drafts one decision per OperationalRecommendation, tagged with the source's generatedBy", () => {
    const rec: OperationalRecommendation = { ruleId: "proposal_completeness.hero_image", message: "Upload a Hero Image.", severity: "warning", node: { nodeType: "proposal", nodeId: "proposal_1" } };
    const drafts = generateDecisionDrafts({ ...emptyInput, recommendationSources: [{ generatedBy: "business_health_engine", recommendations: [rec] }] });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ title: "Upload a Hero Image.", generated_by: "business_health_engine", category: "crm", related_entities: [{ nodeType: "proposal", nodeId: "proposal_1" }] });
  });

  it("routes an approval-named ruleId into the Approvals category regardless of node type", () => {
    const rec: OperationalRecommendation = { ruleId: "proposal_completeness.approval", message: "Complete the missing approval.", severity: "warning", node: { nodeType: "proposal", nodeId: "proposal_1" } };
    const [draft] = generateDecisionDrafts({ ...emptyInput, recommendationSources: [{ generatedBy: "business_health_engine", recommendations: [rec] }] });
    expect(draft.category).toBe("approvals");
  });

  it("carries relatedObjectiveId through to related_objective_ids when the source names one", () => {
    const rec: OperationalRecommendation = { ruleId: "event_completeness.team", message: "Assign an owner.", severity: "warning", node: { nodeType: "event", nodeId: "event_1" } };
    const [draft] = generateDecisionDrafts({ ...emptyInput, recommendationSources: [{ generatedBy: "objective_health_engine", recommendations: [rec], relatedObjectiveId: "objective_1" }] });
    expect(draft.related_objective_ids).toEqual(["objective_1"]);
  });

  it("drafts a decision per broken relationship, one per duplicate/circular group", () => {
    const broken = [makeRel({ source_node_type: "media_asset", source_node_id: "a1", target_node_type: "event", target_node_id: "ghost", relationship_type: "used_by" })];
    const duplicateGroup = [
      makeRel({ id: "d1", source_node_type: "media_asset", source_node_id: "a2", target_node_type: "event", target_node_id: "event_1", relationship_type: "used_by" }),
      makeRel({ id: "d2", source_node_type: "media_asset", source_node_id: "a2", target_node_type: "event", target_node_id: "event_1", relationship_type: "used_by" }),
    ];
    const circularGroup = [makeRel({ id: "c1", source_node_type: "media_folder", source_node_id: "f1", target_node_type: "media_folder", target_node_id: "f2", relationship_type: "belongs_to" })];

    const drafts = generateDecisionDrafts({ ...emptyInput, brokenRelationships: broken, duplicateRelationshipGroups: [duplicateGroup], circularReferenceGroups: [circularGroup] });
    expect(drafts).toHaveLength(3);
    expect(drafts.every((d) => d.category === "knowledge_graph")).toBe(true);
    // businessImpact(10) + blockingRelationship(10) + riskFlag(10) + hardSeverity(15) = 45 -> "medium" under priorityEngine's disclosed thresholds.
    expect(drafts.find((d) => d.title === "Resolve circular reference")?.priority).toBe("medium");
  });

  it("drafts a decision per expired document, naming the document in the title", () => {
    const drafts = generateDecisionDrafts({ ...emptyInput, expiredDocuments: [makeDocument({ id: "doc_1", title: "Vendor Agreement" })] });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].title).toBe("Review expired document: Vendor Agreement");
    expect(drafts[0].category).toBe("documents");
  });

  it("generates a stable dedupe_key so the same finding always produces the same key", () => {
    const rec: OperationalRecommendation = { ruleId: "proposal_completeness.hero_image", message: "Upload a Hero Image.", severity: "warning", node: { nodeType: "proposal", nodeId: "proposal_1" } };
    const input: GenerateDecisionDraftsInput = { ...emptyInput, recommendationSources: [{ generatedBy: "business_health_engine", recommendations: [rec] }] };
    const [first] = generateDecisionDrafts(input);
    const [second] = generateDecisionDrafts(input);
    expect(first.dedupe_key).toBe(second.dedupe_key);
  });
});
