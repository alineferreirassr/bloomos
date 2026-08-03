import { describe, it, expect } from "vitest";
import { computeProposalHealth, type ComputeProposalHealthInput } from "@/core/proposalPlatform/proposalHealthEngine";
import { makeProposal, makeVersion, makeSnapshot } from "@/core/proposalPlatform/testFixtures";

function input(overrides: Partial<ComputeProposalHealthInput> = {}): ComputeProposalHealthInput {
  return {
    proposal: makeProposal(),
    builderState: null,
    currentVersion: makeVersion(),
    hasClient: true,
    requiredSectionKeys: ["whats_included"],
    journeyReadinessScore: null,
    evaluatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("computeProposalHealth", () => {
  it("marks every category not applicable when no version exists yet", () => {
    const health = computeProposalHealth(input({ currentVersion: null }));
    const applicable = health.categories.filter((c) => c.score !== null);
    expect(applicable.length).toBeLessThan(health.categories.length);
  });

  it("scores completeness highly for a fully-filled snapshot", () => {
    const health = computeProposalHealth(input());
    const completeness = health.categories.find((c) => c.category === "completeness");
    expect(completeness?.score).toBeGreaterThanOrEqual(80);
  });

  it("flags a missing client in completeness issues", () => {
    const health = computeProposalHealth(input({ hasClient: false }));
    const completeness = health.categories.find((c) => c.category === "completeness");
    expect(completeness?.issues.some((i) => i.toLowerCase().includes("client"))).toBe(true);
  });

  it("penalizes pricing health when no grand total exists", () => {
    const zeroPricing = makeSnapshot({ pricing: { currency: "USD", basePrice_minor: 0, lineItems: [], packagesSubtotal_minor: 0, addonsSubtotal_minor: 0, optionalServicesTotal_minor: 0, subtotal_minor: 0, discountAmount_minor: 0, taxAmount_minor: 0, grandTotal_minor: 0, depositDue_minor: 0, remainingBalance_minor: 0 } });
    const health = computeProposalHealth(input({ currentVersion: makeVersion({ snapshot: zeroPricing }) }));
    const pricing = health.categories.find((c) => c.category === "pricing_health");
    expect(pricing?.score).toBeLessThan(100);
  });

  it("scores required_sections not applicable when no required sections are named", () => {
    const health = computeProposalHealth(input({ requiredSectionKeys: [] }));
    const required = health.categories.find((c) => c.category === "required_sections");
    expect(required?.score).toBeNull();
  });

  it("flags missing required sections", () => {
    const health = computeProposalHealth(input({ requiredSectionKeys: ["terms", "policies"] }));
    const required = health.categories.find((c) => c.category === "required_sections");
    expect(required?.score).toBeLessThan(100);
  });

  it("marks journey_readiness not applicable when no journey score is supplied", () => {
    const health = computeProposalHealth(input({ journeyReadinessScore: null }));
    const journey = health.categories.find((c) => c.category === "journey_readiness");
    expect(journey?.notApplicableReason).not.toBeNull();
  });

  it("passes through a supplied journey readiness score", () => {
    const health = computeProposalHealth(input({ journeyReadinessScore: 85 }));
    const journey = health.categories.find((c) => c.category === "journey_readiness");
    expect(journey?.score).toBe(85);
  });

  it("computes overall score as the average of applicable categories only", () => {
    const health = computeProposalHealth(input());
    expect(health.overallScore).toBeGreaterThan(0);
    expect(health.overallScore).toBeLessThanOrEqual(100);
  });

  it("rewards a template being used in template_health", () => {
    const health = computeProposalHealth(input());
    const template = health.categories.find((c) => c.category === "template_health");
    expect(template?.score).toBe(100);
  });
});
