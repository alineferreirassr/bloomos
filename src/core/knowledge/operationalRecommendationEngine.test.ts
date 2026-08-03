import { describe, expect, it } from "vitest";
import { recommendationsFromMissingRequirements, recommendationsFromViolations } from "@/core/knowledge/operationalRecommendationEngine";
import type { BusinessRuleViolation } from "@/types/businessHealth";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";

describe("recommendationsFromMissingRequirements", () => {
  it("maps a known missing requirement to its templated rule id and message", () => {
    const node: KnowledgeNodeRef = { nodeType: "proposal", nodeId: "proposal_1" };
    const [rec] = recommendationsFromMissingRequirements(node, ["Missing Hero Image"]);
    expect(rec).toEqual({ ruleId: "proposal_completeness.hero_image", message: "Upload a Hero Image.", severity: "warning", node });
  });

  it("marks critical requirements as critical severity", () => {
    const node: KnowledgeNodeRef = { nodeType: "proposal", nodeId: "proposal_1" };
    const [rec] = recommendationsFromMissingRequirements(node, ["Missing Contract"]);
    expect(rec.severity).toBe("critical");
  });

  it("falls back to a derived rule id for an unrecognized requirement, never dropping it", () => {
    const node: KnowledgeNodeRef = { nodeType: "client", nodeId: "client_1" };
    const [rec] = recommendationsFromMissingRequirements(node, ["Missing Something Novel"]);
    expect(rec.ruleId).toBe("completeness.missing_something_novel");
    expect(rec.message).toBe("Missing Something Novel");
  });

  it("preserves order and count across multiple requirements", () => {
    const node: KnowledgeNodeRef = { nodeType: "event", nodeId: "event_1" };
    const recs = recommendationsFromMissingRequirements(node, ["Missing Timeline", "Missing Vendor", "Missing Team"]);
    expect(recs.map((r) => r.ruleId)).toEqual(["event_completeness.timeline", "event_completeness.vendor", "event_completeness.team"]);
  });

  it("returns an empty array for a fully complete entity", () => {
    const node: KnowledgeNodeRef = { nodeType: "vendor", nodeId: "vendor_1" };
    expect(recommendationsFromMissingRequirements(node, [])).toEqual([]);
  });
});

describe("recommendationsFromViolations", () => {
  it("uses the friendlier override message for circular_dependency", () => {
    const violation: BusinessRuleViolation = { ruleId: "circular_dependency", description: "Circular reference detected among 2 relationships.", node: { nodeType: "media_folder", nodeId: "f1" }, severity: "hard" };
    const [rec] = recommendationsFromViolations([violation]);
    expect(rec.message).toBe("Resolve the circular relationship.");
    expect(rec.ruleId).toBe("circular_dependency");
    expect(rec.severity).toBe("critical");
  });

  it("falls back to the constraint's own description when no override exists", () => {
    const violation: BusinessRuleViolation = { ruleId: "invoice_belongs_to_exactly_one_proposal", description: "An Invoice must belong to exactly one Proposal.", node: { nodeType: "invoice", nodeId: "invoice_1" }, severity: "hard" };
    const [rec] = recommendationsFromViolations([violation]);
    expect(rec.message).toBe("An Invoice must belong to exactly one Proposal.");
  });

  it("maps soft violations to warning severity", () => {
    const violation: BusinessRuleViolation = { ruleId: "event_requires_at_least_one_hero_image", description: "An Event should have at least one Hero Image.", node: { nodeType: "event", nodeId: "event_1" }, severity: "soft" };
    const [rec] = recommendationsFromViolations([violation]);
    expect(rec.severity).toBe("warning");
  });

  it("returns an empty array for no violations", () => {
    expect(recommendationsFromViolations([])).toEqual([]);
  });
});
