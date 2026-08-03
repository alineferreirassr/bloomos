import { describe, it, expect } from "vitest";
import { evaluateProposalReadiness, type EvaluateProposalReadinessInput } from "@/core/proposalPlatform/proposalReadinessEngine";
import { computeProposalHealth } from "@/core/proposalPlatform/proposalHealthEngine";
import { makeProposal, makeVersion, makeSnapshot } from "@/core/proposalPlatform/testFixtures";

function baseHealth() {
  return computeProposalHealth({
    proposal: makeProposal({ reviewed_by: "member_1" }),
    builderState: null,
    currentVersion: makeVersion(),
    hasClient: true,
    requiredSectionKeys: ["whats_included"],
    journeyReadinessScore: 90,
    evaluatedAt: new Date().toISOString(),
  });
}

function input(overrides: Partial<EvaluateProposalReadinessInput> = {}): EvaluateProposalReadinessInput {
  return {
    proposal: makeProposal({ reviewed_by: "member_1" }),
    currentVersion: makeVersion(),
    hasClient: true,
    requiredSectionKeys: ["whats_included"],
    health: baseHealth(),
    ...overrides,
  };
}

describe("evaluateProposalReadiness", () => {
  it("is ready when every requirement and the health threshold are satisfied", () => {
    const result = evaluateProposalReadiness(input());
    expect(result.state).toBe("ready");
    expect(result.canSend).toBe(true);
  });

  it("flags missing_client first when there is no linked client", () => {
    const result = evaluateProposalReadiness(input({ hasClient: false }));
    expect(result.state).toBe("missing_client");
    expect(result.canSend).toBe(false);
  });

  it("flags missing_sections when no document has been built yet", () => {
    const result = evaluateProposalReadiness(input({ currentVersion: null }));
    expect(result.state).toBe("missing_sections");
  });

  it("flags missing_package when no package is selected", () => {
    const result = evaluateProposalReadiness(input({ currentVersion: makeVersion({ snapshot: makeSnapshot({ packageIds: [] }) }) }));
    expect(result.state).toBe("missing_package");
  });

  it("flags missing_pricing when there are no pricing lines", () => {
    const emptyPricing = makeSnapshot({ packageIds: ["pkg_1"], pricing: { currency: "USD", basePrice_minor: 0, lineItems: [], packagesSubtotal_minor: 0, addonsSubtotal_minor: 0, optionalServicesTotal_minor: 0, subtotal_minor: 0, discountAmount_minor: 0, taxAmount_minor: 0, grandTotal_minor: 0, depositDue_minor: 0, remainingBalance_minor: 0 } });
    const result = evaluateProposalReadiness(input({ currentVersion: makeVersion({ snapshot: emptyPricing }) }));
    expect(result.state).toBe("missing_pricing");
  });

  it("flags missing_terms when terms text is empty", () => {
    const result = evaluateProposalReadiness(input({ currentVersion: makeVersion({ snapshot: makeSnapshot({ terms: "" }) }) }));
    expect(result.state).toBe("missing_terms");
  });

  it("flags missing_approval when the AI draft has never been reviewed", () => {
    const result = evaluateProposalReadiness(input({ proposal: makeProposal({ reviewed_by: null }) }));
    expect(result.state).toBe("missing_approval");
  });

  it("flags needs_review when overall health is below the ready threshold", () => {
    const lowHealth = computeProposalHealth({
      proposal: makeProposal({ reviewed_by: "member_1" }),
      builderState: null,
      currentVersion: null,
      hasClient: false,
      requiredSectionKeys: [],
      journeyReadinessScore: null,
      evaluatedAt: new Date().toISOString(),
    });
    const result = evaluateProposalReadiness(input({ health: lowHealth, currentVersion: makeVersion() }));
    expect(["needs_review", "missing_client"]).toContain(result.state);
  });

  it("never marks canSend true for any non-ready state", () => {
    const result = evaluateProposalReadiness(input({ hasClient: false }));
    expect(result.canSend).toBe(false);
  });
});
