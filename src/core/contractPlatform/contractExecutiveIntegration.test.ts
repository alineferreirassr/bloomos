import { describe, it, expect } from "vitest";
import { contractHealthToRecommendations, acceptedProposalMissingContractRecommendation, type ContractExecutiveContext } from "@/core/contractPlatform/contractExecutiveIntegration";
import { computeContractHealth } from "@/core/contractPlatform/contractHealthEngine";
import { makeContract, makeVersion } from "@/core/contractPlatform/testFixtures";

const NOW = "2026-07-31T00:00:00.000Z";

function baseHealth() {
  return computeContractHealth({
    builderState: null,
    currentVersion: makeVersion(),
    hasClient: true,
    requiredSectionKeys: [],
    requiredClauseKeys: [],
    presentClauseKeys: [],
    hasLinkedProposal: true,
    hasLinkedJourney: true,
    evaluatedAt: NOW,
  });
}

function context(overrides: Partial<ContractExecutiveContext> = {}): ContractExecutiveContext {
  return {
    contract: makeContract(),
    readiness: { state: "ready", reasons: [], canPublish: true },
    health: baseHealth(),
    documentStatus: "draft",
    updatedAt: NOW,
    now: NOW,
    ...overrides,
  };
}

describe("contractHealthToRecommendations", () => {
  it("recommends ready_to_publish when the document can publish", () => {
    const recs = contractHealthToRecommendations(context());
    expect(recs.some((r) => r.ruleId === "contract_platform.ready_to_publish")).toBe(true);
  });

  it("recommends missing_requirements for a missing-client readiness state", () => {
    const recs = contractHealthToRecommendations(context({ readiness: { state: "missing_client", reasons: ["No client."], canPublish: false } }));
    expect(recs.some((r) => r.ruleId === "contract_platform.missing_requirements")).toBe(true);
  });

  it("recommends needs_review for a needs_approval readiness state", () => {
    const recs = contractHealthToRecommendations(context({ readiness: { state: "needs_approval", reasons: ["Awaiting approval."], canPublish: false } }));
    expect(recs.some((r) => r.ruleId === "contract_platform.needs_review")).toBe(true);
  });

  it("recommends archived when the document status is archived", () => {
    const recs = contractHealthToRecommendations(context({ documentStatus: "archived" }));
    expect(recs.some((r) => r.ruleId === "contract_platform.archived")).toBe(true);
  });

  it("recommends stalled when a draft has had no activity for 5+ days", () => {
    const recs = contractHealthToRecommendations(context({ documentStatus: "draft", updatedAt: "2026-07-01T00:00:00.000Z", now: NOW }));
    expect(recs.some((r) => r.ruleId === "contract_platform.stalled")).toBe(true);
  });

  it("does not recommend stalled for a fresh draft", () => {
    const recs = contractHealthToRecommendations(context({ documentStatus: "draft", updatedAt: NOW, now: NOW }));
    expect(recs.some((r) => r.ruleId === "contract_platform.stalled")).toBe(false);
  });

  it("attaches recommendations to the contract's own node", () => {
    const contract = makeContract();
    const recs = contractHealthToRecommendations(context({ contract }));
    expect(recs[0].node).toEqual({ nodeType: "contract", nodeId: contract.id });
  });
});

describe("acceptedProposalMissingContractRecommendation", () => {
  it("returns null when the proposal is not accepted", () => {
    expect(acceptedProposalMissingContractRecommendation("proposal_1", "draft", false)).toBeNull();
  });

  it("returns null when a contract document already exists", () => {
    expect(acceptedProposalMissingContractRecommendation("proposal_1", "accepted", true)).toBeNull();
  });

  it("flags an accepted proposal with no contract document", () => {
    const rec = acceptedProposalMissingContractRecommendation("proposal_1", "accepted", false);
    expect(rec?.ruleId).toBe("contract_platform.proposal_missing_contract");
    expect(rec?.node).toEqual({ nodeType: "proposal", nodeId: "proposal_1" });
  });
});
