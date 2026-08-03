import { describe, it, expect } from "vitest";
import { computeProposalAnalytics, type ProposalAnalyticsInput } from "@/core/proposalPlatform/proposalAnalyticsEngine";
import { makeProposal, makeBuilderState, makeVersion, makeSnapshot } from "@/core/proposalPlatform/testFixtures";

const NOW = new Date().toISOString();

describe("computeProposalAnalytics", () => {
  it("returns all-zero, non-throwing results for an empty workspace", () => {
    const result = computeProposalAnalytics([], NOW);
    expect(result.totalProposals).toBe(0);
    expect(result.acceptanceRate).toBe(0);
    expect(result.conversionRate).toBe(0);
  });

  it("counts accepted and declined proposals", () => {
    const inputs: ProposalAnalyticsInput[] = [
      { proposal: makeProposal({ status: "accepted", reviewed_at: NOW }), builderState: null },
      { proposal: makeProposal({ status: "rejected", reviewed_at: NOW }), builderState: null },
      { proposal: makeProposal({ status: "draft" }), builderState: null },
    ];
    const result = computeProposalAnalytics(inputs, NOW);
    expect(result.acceptedCount).toBe(1);
    expect(result.declinedCount).toBe(1);
    expect(result.totalProposals).toBe(3);
  });

  it("computes acceptance rate over decided proposals only", () => {
    const inputs: ProposalAnalyticsInput[] = [
      { proposal: makeProposal({ status: "accepted", reviewed_at: NOW }), builderState: null },
      { proposal: makeProposal({ status: "rejected", reviewed_at: NOW }), builderState: null },
      { proposal: makeProposal({ status: "draft" }), builderState: null },
    ];
    const result = computeProposalAnalytics(inputs, NOW);
    expect(result.acceptanceRate).toBe(50);
  });

  it("computes conversion rate over every proposal ever created", () => {
    const inputs: ProposalAnalyticsInput[] = [
      { proposal: makeProposal({ status: "accepted", reviewed_at: NOW }), builderState: null },
      { proposal: makeProposal({ status: "draft" }), builderState: null },
      { proposal: makeProposal({ status: "draft" }), builderState: null },
      { proposal: makeProposal({ status: "draft" }), builderState: null },
    ];
    const result = computeProposalAnalytics(inputs, NOW);
    expect(result.conversionRate).toBe(25);
  });

  it("counts document statuses from builder state", () => {
    const inputs: ProposalAnalyticsInput[] = [
      { proposal: makeProposal(), builderState: makeBuilderState({ status: "draft" }) },
      { proposal: makeProposal(), builderState: makeBuilderState({ status: "published" }) },
      { proposal: makeProposal(), builderState: makeBuilderState({ status: "archived" }) },
    ];
    const result = computeProposalAnalytics(inputs, NOW);
    expect(result.draftCount).toBe(1);
    expect(result.publishedCount).toBe(1);
    expect(result.archivedCount).toBe(1);
  });

  it("counts sent and viewed proposals", () => {
    const inputs: ProposalAnalyticsInput[] = [{ proposal: makeProposal(), builderState: makeBuilderState({ sent_at: NOW, viewed_at: NOW }) }];
    const result = computeProposalAnalytics(inputs, NOW);
    expect(result.sentCount).toBe(1);
    expect(result.viewedCount).toBe(1);
  });

  it("averages proposal grand total across builder states with a current version", () => {
    const inputs: ProposalAnalyticsInput[] = [
      { proposal: makeProposal(), builderState: makeBuilderState() },
      { proposal: makeProposal(), builderState: makeBuilderState() },
    ];
    const result = computeProposalAnalytics(inputs, NOW);
    expect(result.averageProposalValue_minor).toBeGreaterThan(0);
  });

  it("tallies template, package, and add-on usage", () => {
    const version = makeVersion({ snapshot: makeSnapshot({ templateKey: "luxury_proposal", packageIds: ["pkg_a"], addonIds: ["addon_a"] }) });
    const state = makeBuilderState({ current_version_id: version.id, versions: [version] });
    const result = computeProposalAnalytics([{ proposal: makeProposal(), builderState: state }], NOW);
    expect(result.templateUsage["luxury_proposal"]).toBe(1);
    expect(result.packageUsage["pkg_a"]).toBe(1);
    expect(result.addonUsage["addon_a"]).toBe(1);
  });

  it("counts revisions as versions beyond the first", () => {
    const v1 = makeVersion({ version_number: 1 });
    const v2 = makeVersion({ version_number: 2 });
    const state = makeBuilderState({ versions: [v1, v2], current_version_id: v2.id });
    const result = computeProposalAnalytics([{ proposal: makeProposal(), builderState: state }], NOW);
    expect(result.averageRevisionCount).toBe(1);
  });

  it("returns null average time to accept when nothing has been accepted yet", () => {
    const result = computeProposalAnalytics([{ proposal: makeProposal({ status: "draft" }), builderState: null }], NOW);
    expect(result.averageTimeToAcceptHours).toBeNull();
  });
});
