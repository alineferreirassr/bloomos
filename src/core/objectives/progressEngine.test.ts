import { describe, expect, it } from "vitest";
import { computeObjectiveProgress, type RequirementContext } from "@/core/objectives/progressEngine";
import type { Objective, ObjectiveRequirement } from "@/types/objectives";
import type { KnowledgeRelationship } from "@/types/knowledgeGraph";
import type { BusinessRuleViolation } from "@/types/businessHealth";
import type { Comment } from "@/types/comment";
import type { TimelineActivity } from "@/types/timelineActivity";

function makeObjective(overrides: Partial<Objective> = {}): Objective {
  return {
    id: "objective_1",
    workspace_id: "ws_1",
    scope: "event",
    node: { nodeType: "event", nodeId: "event_1" },
    title: "Event is fully ready",
    description: null,
    status: "in_progress",
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

function makeContext(overrides: Partial<RequirementContext> = {}): RequirementContext {
  return {
    relationships: [],
    comments: [],
    timelineActivities: [],
    mediaMetadata: null,
    mediaTags: null,
    approvalFlags: {},
    businessRuleViolations: [],
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

describe("computeObjectiveProgress", () => {
  it("returns 100% completion for an objective with no requirements", () => {
    const progress = computeObjectiveProgress(makeObjective(), makeContext());
    expect(progress).toEqual({ objectiveId: "objective_1", completionPercent: 100, missingRequirements: [], blockingIssues: [], remainingTasks: [], estimatedProgress: 100 });
  });

  it("evaluates a required_assets requirement via edgeCountsForRule", () => {
    const requirement: ObjectiveRequirement = { id: "r1", type: "required_assets", description: "Needs a Hero Image", relationshipType: "used_by", direction: "inbound", counterpartNodeType: "media_asset", requiredRole: "hero_image", minCount: 1 };
    const objective = makeObjective({ requirements: [requirement] });

    const unmet = computeObjectiveProgress(objective, makeContext());
    expect(unmet.completionPercent).toBe(0);
    expect(unmet.missingRequirements[0]).toContain("Needs a Hero Image");

    const relationships = [
      makeRel({
        source_node_type: "media_asset",
        source_node_id: "asset_1",
        target_node_type: "event",
        target_node_id: "event_1",
        relationship_type: "used_by",
        semantics: { role: "hero_image", businessMeaning: null, category: null, importance: null, priority: null, lifecycle: null, visibility: null, ownerMemberId: null, businessContext: null },
      }),
    ];
    const met = computeObjectiveProgress(objective, makeContext({ relationships }));
    expect(met.completionPercent).toBe(100);
  });

  it("evaluates a required_approvals requirement from the resolved approvalFlags bag", () => {
    const requirement: ObjectiveRequirement = { id: "r1", type: "required_approvals", description: "Proposal must be reviewed", approvalKey: "proposal_reviewed" };
    const objective = makeObjective({ requirements: [requirement] });

    expect(computeObjectiveProgress(objective, makeContext()).completionPercent).toBe(0);
    expect(computeObjectiveProgress(objective, makeContext({ approvalFlags: { proposal_reviewed: true } })).completionPercent).toBe(100);
  });

  it("evaluates a required_metadata requirement against a named field and a custom field", () => {
    const requirement: ObjectiveRequirement = { id: "r1", type: "required_metadata", description: "Needs a license", metadataField: "license" };
    const objective = makeObjective({ requirements: [requirement] });

    expect(computeObjectiveProgress(objective, makeContext()).completionPercent).toBe(0);

    const withLicense = makeContext({ mediaMetadata: { pages: null, author: null, license: "CC-BY", brand: null, colorProfile: null, cameraData: null, location: null, custom: {} } });
    expect(computeObjectiveProgress(objective, withLicense).completionPercent).toBe(100);

    const customRequirement: ObjectiveRequirement = { id: "r2", type: "required_metadata", description: "Needs a shoot date", metadataField: "shootDate" };
    const withCustom = makeContext({ mediaMetadata: { pages: null, author: null, license: null, brand: null, colorProfile: null, cameraData: null, location: null, custom: { shootDate: "2026-07-01" } } });
    expect(computeObjectiveProgress(makeObjective({ requirements: [customRequirement] }), withCustom).completionPercent).toBe(100);
  });

  it("evaluates a required_tags requirement, listing every missing tag", () => {
    const requirement: ObjectiveRequirement = { id: "r1", type: "required_tags", description: "Needs brand tags", requiredTags: ["approved", "final"] };
    const objective = makeObjective({ requirements: [requirement] });

    const partial = computeObjectiveProgress(objective, makeContext({ mediaTags: ["approved"] }));
    expect(partial.completionPercent).toBe(0);
    expect(partial.missingRequirements[0]).toContain("final");

    expect(computeObjectiveProgress(objective, makeContext({ mediaTags: ["approved", "final"] })).completionPercent).toBe(100);
  });

  it("evaluates a required_timeline_activity requirement by counting matching activity types", () => {
    const requirement: ObjectiveRequirement = { id: "r1", type: "required_timeline_activity", description: "Needs a status change logged", timelineActivityType: "status_changed", minCount: 2 };
    const objective = makeObjective({ requirements: [requirement] });
    const activity = (type: TimelineActivity["type"]): TimelineActivity => ({ id: `a_${Math.random()}`, workspace_id: "ws_1", owner_type: "event", owner_id: "event_1", type, description: "x", actor: "member_1", timestamp: "2026-01-01T00:00:00.000Z" });

    expect(computeObjectiveProgress(objective, makeContext({ timelineActivities: [activity("status_changed")] })).completionPercent).toBe(0);
    expect(computeObjectiveProgress(objective, makeContext({ timelineActivities: [activity("status_changed"), activity("status_changed")] })).completionPercent).toBe(100);
  });

  it("evaluates a required_communication requirement by comment count", () => {
    const requirement: ObjectiveRequirement = { id: "r1", type: "required_communication", description: "Needs client discussion", minCommentCount: 1 };
    const objective = makeObjective({ requirements: [requirement] });
    const comment: Comment = { id: "c1", workspace_id: "ws_1", owner_type: "event", owner_id: "event_1", parent_comment_id: null, body: "hi", author: "member_1", created_at: "2026-01-01T00:00:00.000Z", edited_at: null, deleted_at: null, mentioned_member_ids: [], mentions_team: false };

    expect(computeObjectiveProgress(objective, makeContext()).completionPercent).toBe(0);
    expect(computeObjectiveProgress(objective, makeContext({ comments: [comment] })).completionPercent).toBe(100);
  });

  it("evaluates a required_business_rules requirement, scoped to a specific rule id or any violation", () => {
    const violation: BusinessRuleViolation = { ruleId: "circular_dependency", description: "cycle", node: { nodeType: "event", nodeId: "event_1" }, severity: "hard" };
    const scoped: ObjectiveRequirement = { id: "r1", type: "required_business_rules", description: "No circular dependencies", businessRuleId: "circular_dependency" };
    const any: ObjectiveRequirement = { id: "r2", type: "required_business_rules", description: "No violations at all", businessRuleId: null };

    expect(computeObjectiveProgress(makeObjective({ requirements: [scoped] }), makeContext({ businessRuleViolations: [violation] })).completionPercent).toBe(0);
    expect(computeObjectiveProgress(makeObjective({ requirements: [scoped] }), makeContext()).completionPercent).toBe(100);
    expect(computeObjectiveProgress(makeObjective({ requirements: [any] }), makeContext({ businessRuleViolations: [violation] })).completionPercent).toBe(0);
  });

  it("computes a partial completion percentage across multiple requirements", () => {
    const requirements: ObjectiveRequirement[] = [
      { id: "r1", type: "required_approvals", description: "A", approvalKey: "a" },
      { id: "r2", type: "required_approvals", description: "B", approvalKey: "b" },
      { id: "r3", type: "required_approvals", description: "C", approvalKey: "c" },
      { id: "r4", type: "required_approvals", description: "D", approvalKey: "d" },
    ];
    const objective = makeObjective({ requirements });
    const progress = computeObjectiveProgress(objective, makeContext({ approvalFlags: { a: true, b: true, c: false, d: false } }));
    expect(progress.completionPercent).toBe(50);
    expect(progress.remainingTasks).toEqual(["C", "D"]);
  });
});
