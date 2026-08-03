import { describe, it, expect } from "vitest";
import { computeContractAnalytics, type ContractAnalyticsInput } from "@/core/contractPlatform/contractAnalyticsEngine";
import { makeBuilderState, makeContract, makeVersion, makeSnapshot } from "@/core/contractPlatform/testFixtures";

const NOW = "2026-07-31T00:00:00.000Z";

describe("computeContractAnalytics", () => {
  it("returns all-zero/null defaults for an empty input list", () => {
    const result = computeContractAnalytics([], NOW);
    expect(result.totalContracts).toBe(0);
    expect(result.averageContractValue_minor).toBe(0);
    expect(result.averageRevisionCount).toBe(0);
    expect(result.averageTimeInDraftHours).toBeNull();
    expect(result.averageTimeToReadyHours).toBeNull();
    expect(result.completionRate).toBe(0);
    expect(result.templateUsage).toEqual({});
    expect(result.clauseUsage).toEqual({});
  });

  it("counts contracts without a builder state toward totalContracts only", () => {
    const inputs: ContractAnalyticsInput[] = [{ contract: makeContract(), builderState: null }];
    const result = computeContractAnalytics(inputs, NOW);
    expect(result.totalContracts).toBe(1);
    expect(result.draftCount).toBe(0);
    expect(result.completionRate).toBe(0);
  });

  it("buckets documents by document status", () => {
    const inputs: ContractAnalyticsInput[] = [
      { contract: makeContract(), builderState: makeBuilderState({ status: "draft" }) },
      { contract: makeContract(), builderState: makeBuilderState({ status: "review" }) },
      { contract: makeContract(), builderState: makeBuilderState({ status: "published" }) },
      { contract: makeContract(), builderState: makeBuilderState({ status: "archived" }) },
    ];
    const result = computeContractAnalytics(inputs, NOW);
    expect(result.draftCount).toBe(1);
    expect(result.reviewCount).toBe(1);
    expect(result.publishedCount).toBe(1);
    expect(result.archivedCount).toBe(1);
  });

  it("averages contract value from each current version's pricing reference", () => {
    const v1 = makeVersion({ snapshot: makeSnapshot({ pricingReference: { proposalId: "p1", grandTotal_minor: 100000, currency: "USD", depositDue_minor: 30000, remainingBalance_minor: 70000 } }) });
    const v2 = makeVersion({ snapshot: makeSnapshot({ pricingReference: { proposalId: "p2", grandTotal_minor: 50000, currency: "USD", depositDue_minor: 15000, remainingBalance_minor: 35000 } }) });
    const inputs: ContractAnalyticsInput[] = [
      { contract: makeContract(), builderState: makeBuilderState({ current_version_id: v1.id, versions: [v1] }) },
      { contract: makeContract(), builderState: makeBuilderState({ current_version_id: v2.id, versions: [v2] }) },
    ];
    const result = computeContractAnalytics(inputs, NOW);
    expect(result.averageContractValue_minor).toBe(75000);
  });

  it("excludes contracts with no resolvable pricing reference from the average", () => {
    const v1 = makeVersion({ snapshot: makeSnapshot({ pricingReference: null }) });
    const inputs: ContractAnalyticsInput[] = [{ contract: makeContract(), builderState: makeBuilderState({ current_version_id: v1.id, versions: [v1] }) }];
    const result = computeContractAnalytics(inputs, NOW);
    expect(result.averageContractValue_minor).toBe(0);
  });

  it("counts revisions as versions.length - 1", () => {
    const v1 = makeVersion({ version_number: 1 });
    const v2 = makeVersion({ version_number: 2 });
    const v3 = makeVersion({ version_number: 3 });
    const inputs: ContractAnalyticsInput[] = [{ contract: makeContract(), builderState: makeBuilderState({ versions: [v1, v2, v3], current_version_id: v3.id }) }];
    const result = computeContractAnalytics(inputs, NOW);
    expect(result.averageRevisionCount).toBe(2);
  });

  it("tallies template usage by builderTemplateKey", () => {
    const v1 = makeVersion({ snapshot: makeSnapshot({ builderTemplateKey: "nda" }) });
    const v2 = makeVersion({ snapshot: makeSnapshot({ builderTemplateKey: "nda" }) });
    const v3 = makeVersion({ snapshot: makeSnapshot({ builderTemplateKey: "vendor_agreement" }) });
    const inputs: ContractAnalyticsInput[] = [
      { contract: makeContract(), builderState: makeBuilderState({ current_version_id: v1.id, versions: [v1] }) },
      { contract: makeContract(), builderState: makeBuilderState({ current_version_id: v2.id, versions: [v2] }) },
      { contract: makeContract(), builderState: makeBuilderState({ current_version_id: v3.id, versions: [v3] }) },
    ];
    const result = computeContractAnalytics(inputs, NOW);
    expect(result.templateUsage).toEqual({ nda: 2, vendor_agreement: 1 });
  });

  it("tallies clause usage across each version's clauseIds", () => {
    const v1 = makeVersion({ snapshot: makeSnapshot({ clauseIds: ["payment_terms", "liability"] }) });
    const v2 = makeVersion({ snapshot: makeSnapshot({ clauseIds: ["payment_terms"] }) });
    const inputs: ContractAnalyticsInput[] = [
      { contract: makeContract(), builderState: makeBuilderState({ current_version_id: v1.id, versions: [v1] }) },
      { contract: makeContract(), builderState: makeBuilderState({ current_version_id: v2.id, versions: [v2] }) },
    ];
    const result = computeContractAnalytics(inputs, NOW);
    expect(result.clauseUsage).toEqual({ payment_terms: 2, liability: 1 });
  });

  it("computes average time in draft only for documents that left draft status", () => {
    const stillDraft = makeBuilderState({ status: "draft", created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-05T00:00:00.000Z" });
    const movedOn = makeBuilderState({ status: "review", created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-02T00:00:00.000Z" });
    const inputs: ContractAnalyticsInput[] = [
      { contract: makeContract(), builderState: stillDraft },
      { contract: makeContract(), builderState: movedOn },
    ];
    const result = computeContractAnalytics(inputs, NOW);
    expect(result.averageTimeInDraftHours).toBe(24);
  });

  it("computes average time to ready only for documents with ready_at set", () => {
    const ready = makeBuilderState({ created_at: "2026-07-01T00:00:00.000Z", ready_at: "2026-07-04T00:00:00.000Z" });
    const notReady = makeBuilderState({ ready_at: null });
    const inputs: ContractAnalyticsInput[] = [
      { contract: makeContract(), builderState: ready },
      { contract: makeContract(), builderState: notReady },
    ];
    const result = computeContractAnalytics(inputs, NOW);
    expect(result.averageTimeToReadyHours).toBe(72);
  });

  it("computes completion rate as ready-or-published over documents started", () => {
    const published = makeBuilderState({ status: "published" });
    const readyNotPublished = makeBuilderState({ status: "review", ready_at: NOW });
    const neither = makeBuilderState({ status: "draft", ready_at: null });
    const inputs: ContractAnalyticsInput[] = [
      { contract: makeContract(), builderState: published },
      { contract: makeContract(), builderState: readyNotPublished },
      { contract: makeContract(), builderState: neither },
      { contract: makeContract(), builderState: null },
    ];
    const result = computeContractAnalytics(inputs, NOW);
    expect(result.completionRate).toBe(67);
  });

  it("stamps the caller-provided evaluatedAt", () => {
    const result = computeContractAnalytics([], NOW);
    expect(result.evaluatedAt).toBe(NOW);
  });
});
