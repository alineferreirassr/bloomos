import { describe, it, expect } from "vitest";
import { computeContractHealth, type ComputeContractHealthInput } from "@/core/contractPlatform/contractHealthEngine";
import { makeVersion, makeSnapshot } from "@/core/contractPlatform/testFixtures";

function input(overrides: Partial<ComputeContractHealthInput> = {}): ComputeContractHealthInput {
  return {
    builderState: null,
    currentVersion: makeVersion(),
    hasClient: true,
    requiredSectionKeys: ["payment_terms"],
    requiredClauseKeys: [],
    presentClauseKeys: [],
    hasLinkedProposal: true,
    hasLinkedJourney: true,
    evaluatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("computeContractHealth", () => {
  it("marks every version-dependent category not applicable when no version exists yet", () => {
    const health = computeContractHealth(input({ currentVersion: null }));
    const completeness = health.categories.find((c) => c.category === "completeness");
    expect(completeness?.score).toBeNull();
  });

  it("scores completeness highly for a fully-filled snapshot", () => {
    const health = computeContractHealth(input());
    const completeness = health.categories.find((c) => c.category === "completeness");
    expect(completeness?.score).toBeGreaterThanOrEqual(80);
  });

  it("flags a missing client in completeness issues", () => {
    const health = computeContractHealth(input({ hasClient: false }));
    const completeness = health.categories.find((c) => c.category === "completeness");
    expect(completeness?.issues.some((i) => i.toLowerCase().includes("client"))).toBe(true);
  });

  it("marks missing_variables not applicable when no placeholders are referenced", () => {
    const health = computeContractHealth(input());
    const missingVariables = health.categories.find((c) => c.category === "missing_variables");
    expect(missingVariables?.notApplicableReason).not.toBeNull();
  });

  it("flags an unresolved variable placeholder", () => {
    const snapshot = makeSnapshot({ terms: "{{client_name}} agrees to {{unresolved_key}}.", variables: [{ key: "client_name", label: "Client Name", value: "Jordan" }] });
    const health = computeContractHealth(input({ currentVersion: makeVersion({ snapshot }) }));
    const missingVariables = health.categories.find((c) => c.category === "missing_variables");
    expect(missingVariables?.score).toBeLessThan(100);
  });

  it("scores missing_clauses not applicable when no clauses are required", () => {
    const health = computeContractHealth(input({ requiredClauseKeys: [] }));
    const missingClauses = health.categories.find((c) => c.category === "missing_clauses");
    expect(missingClauses?.score).toBeNull();
  });

  it("flags a missing required clause", () => {
    const health = computeContractHealth(input({ requiredClauseKeys: ["payment_terms", "liability"], presentClauseKeys: ["payment_terms"] }));
    const missingClauses = health.categories.find((c) => c.category === "missing_clauses");
    expect(missingClauses?.score).toBeLessThan(100);
  });

  it("scores proposal_link/journey_link/client_link as binary presence checks", () => {
    const health = computeContractHealth(input({ hasLinkedProposal: false, hasLinkedJourney: false, hasClient: false }));
    expect(health.categories.find((c) => c.category === "proposal_link")?.score).toBe(0);
    expect(health.categories.find((c) => c.category === "journey_link")?.score).toBe(0);
    expect(health.categories.find((c) => c.category === "client_link")?.score).toBe(0);
  });

  it("computes overall score as the average of applicable categories only", () => {
    const health = computeContractHealth(input());
    expect(health.overallScore).toBeGreaterThan(0);
    expect(health.overallScore).toBeLessThanOrEqual(100);
  });

  it("flags missing required sections", () => {
    const health = computeContractHealth(input({ requiredSectionKeys: ["signatures"] }));
    const missingSections = health.categories.find((c) => c.category === "missing_sections");
    expect(missingSections?.score).toBeLessThan(100);
  });
});
