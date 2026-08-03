import { describe, it, expect } from "vitest";
import { proposalHealthToRecommendations, type ProposalExecutiveContext } from "@/core/proposalPlatform/proposalExecutiveIntegration";
import { makeProposal } from "@/core/proposalPlatform/testFixtures";

const NOW = new Date("2026-07-31T00:00:00.000Z").toISOString();

function context(overrides: Partial<ProposalExecutiveContext> = {}): ProposalExecutiveContext {
  return {
    proposal: makeProposal({ status: "draft" }),
    readiness: { state: "ready", reasons: [], canSend: true },
    health: { categories: [], overallScore: 90, evaluatedAt: NOW },
    grandTotal_minor: 65000,
    documentStatus: "published",
    sentAt: null,
    updatedAt: NOW,
    now: NOW,
    ...overrides,
  };
}

describe("proposalHealthToRecommendations", () => {
  it("emits ready_to_send when readiness.canSend is true", () => {
    const recs = proposalHealthToRecommendations(context());
    expect(recs.some((r) => r.ruleId === "proposal_platform.ready_to_send")).toBe(true);
  });

  it("emits missing_pricing when readiness state is missing_pricing", () => {
    const recs = proposalHealthToRecommendations(context({ readiness: { state: "missing_pricing", reasons: ["No pricing."], canSend: false } }));
    expect(recs.some((r) => r.ruleId === "proposal_platform.missing_pricing")).toBe(true);
  });

  it("emits needs_review when readiness state is needs_review", () => {
    const recs = proposalHealthToRecommendations(context({ readiness: { state: "needs_review", reasons: ["Low health."], canSend: false } }));
    expect(recs.some((r) => r.ruleId === "proposal_platform.needs_review")).toBe(true);
  });

  it("emits archived when the document status is archived", () => {
    const recs = proposalHealthToRecommendations(context({ documentStatus: "archived" }));
    expect(recs.some((r) => r.ruleId === "proposal_platform.archived")).toBe(true);
  });

  it("emits stalled for a draft proposal with no recent activity", () => {
    const old = new Date(new Date(NOW).getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const recs = proposalHealthToRecommendations(context({ updatedAt: old, proposal: makeProposal({ status: "draft" }) }));
    expect(recs.some((r) => r.ruleId === "proposal_platform.stalled")).toBe(true);
  });

  it("does not emit stalled for a recently-updated proposal", () => {
    const recs = proposalHealthToRecommendations(context({ updatedAt: NOW, proposal: makeProposal({ status: "draft" }) }));
    expect(recs.some((r) => r.ruleId === "proposal_platform.stalled")).toBe(false);
  });

  it("emits expiring when a sent proposal has been undecided for a long time", () => {
    const old = new Date(new Date(NOW).getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const recs = proposalHealthToRecommendations(context({ sentAt: old, proposal: makeProposal({ status: "draft" }) }));
    expect(recs.some((r) => r.ruleId === "proposal_platform.expiring")).toBe(true);
  });

  it("emits high_value_waiting for a high-value undecided sent proposal", () => {
    const recs = proposalHealthToRecommendations(context({ sentAt: NOW, grandTotal_minor: 1_000_00, proposal: makeProposal({ status: "draft" }) }));
    expect(recs.some((r) => r.ruleId === "proposal_platform.high_value_waiting" && r.severity === "critical")).toBe(true);
  });

  it("never emits high_value_waiting for a low-value proposal", () => {
    const recs = proposalHealthToRecommendations(context({ sentAt: NOW, grandTotal_minor: 1000, proposal: makeProposal({ status: "draft" }) }));
    expect(recs.some((r) => r.ruleId === "proposal_platform.high_value_waiting")).toBe(false);
  });

  it("always tags every recommendation with the proposal's own node", () => {
    const proposal = makeProposal();
    const recs = proposalHealthToRecommendations(context({ proposal }));
    expect(recs.every((r) => r.node.nodeType === "proposal" && r.node.nodeId === proposal.id)).toBe(true);
  });
});
