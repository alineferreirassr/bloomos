import { describe, it, expect } from "vitest";
import { evaluateContractReadiness, type EvaluateContractReadinessInput } from "@/core/contractPlatform/contractReadinessEngine";
import { computeContractHealth } from "@/core/contractPlatform/contractHealthEngine";
import { makeVersion } from "@/core/contractPlatform/testFixtures";

function baseHealth() {
  return computeContractHealth({
    builderState: null,
    currentVersion: makeVersion(),
    hasClient: true,
    requiredSectionKeys: ["payment_terms"],
    requiredClauseKeys: [],
    presentClauseKeys: [],
    hasLinkedProposal: true,
    hasLinkedJourney: true,
    evaluatedAt: new Date().toISOString(),
  });
}

function input(overrides: Partial<EvaluateContractReadinessInput> = {}): EvaluateContractReadinessInput {
  return {
    currentVersion: makeVersion(),
    documentStatus: "draft",
    hasClient: true,
    hasLinkedProposal: true,
    requiredSectionKeys: ["payment_terms"],
    requiredClauseKeys: [],
    presentClauseKeys: [],
    health: baseHealth(),
    ...overrides,
  };
}

describe("evaluateContractReadiness", () => {
  it("is ready when every requirement and the health threshold are satisfied", () => {
    const result = evaluateContractReadiness(input());
    expect(result.state).toBe("ready");
    expect(result.canPublish).toBe(true);
  });

  it("flags missing_client first when there is no linked client", () => {
    const result = evaluateContractReadiness(input({ hasClient: false }));
    expect(result.state).toBe("missing_client");
    expect(result.canPublish).toBe(false);
  });

  it("flags missing_sections when no document has been built yet", () => {
    const result = evaluateContractReadiness(input({ currentVersion: null, health: computeContractHealth({ builderState: null, currentVersion: null, hasClient: true, requiredSectionKeys: [], requiredClauseKeys: [], presentClauseKeys: [], hasLinkedProposal: true, hasLinkedJourney: true, evaluatedAt: new Date().toISOString() }) }));
    expect(result.state).toBe("missing_sections");
  });

  it("flags missing_proposal when no Proposal is linked", () => {
    const result = evaluateContractReadiness(input({ hasLinkedProposal: false }));
    expect(result.state).toBe("missing_proposal");
  });

  it("flags missing_sections when a required section is absent", () => {
    const result = evaluateContractReadiness(input({ requiredSectionKeys: ["signatures"] }));
    expect(result.state).toBe("missing_sections");
  });

  it("flags missing_clauses when a required clause is absent", () => {
    const result = evaluateContractReadiness(input({ requiredClauseKeys: ["liability"], presentClauseKeys: [] }));
    expect(result.state).toBe("missing_clauses");
  });

  it("flags needs_approval when the document status is review", () => {
    const result = evaluateContractReadiness(input({ documentStatus: "review" }));
    expect(result.state).toBe("needs_approval");
  });

  it("flags needs_review when overall health is below the ready threshold", () => {
    const lowHealth = computeContractHealth({ builderState: null, currentVersion: null, hasClient: false, requiredSectionKeys: [], requiredClauseKeys: [], presentClauseKeys: [], hasLinkedProposal: false, hasLinkedJourney: false, evaluatedAt: new Date().toISOString() });
    const result = evaluateContractReadiness(input({ health: lowHealth }));
    expect(["needs_review", "missing_client", "missing_proposal"]).toContain(result.state);
  });

  it("never marks canPublish true for any non-ready state", () => {
    const result = evaluateContractReadiness(input({ hasClient: false }));
    expect(result.canPublish).toBe(false);
  });
});
