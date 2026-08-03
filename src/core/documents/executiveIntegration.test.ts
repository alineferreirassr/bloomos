import { describe, it, expect } from "vitest";
import { documentPlatformRecommendationsForExecutiveDecisions, type DocumentBundleHealthInput } from "@/core/documents/executiveIntegration";
import type { ComposedDocumentHealth, DocumentBundle, DocumentBundleHealth } from "@/types/documentPlatform";

const evaluatedAt = new Date().toISOString();

function makeBundle(overrides: Partial<DocumentBundle> = {}): DocumentBundle {
  return {
    id: "bundle_1",
    workspaceId: "ws_1",
    clientId: "client_1",
    eventId: null,
    title: "Welcome Packet",
    description: "",
    status: "draft",
    items: [{ id: "item_1", kind: "composed_document", refId: "doc_1", addedAt: evaluatedAt }],
    createdBy: "member_1",
    createdAt: evaluatedAt,
    updatedAt: evaluatedAt,
    sentAt: null,
    ...overrides,
  };
}

function makeBundleHealth(overrides: Partial<DocumentBundleHealth> = {}): DocumentBundleHealth {
  return {
    categories: [
      { category: "completeness", score: 100, issues: [], notApplicableReason: null },
      { category: "items_availability", score: 100, issues: [], notApplicableReason: null },
      { category: "client_link", score: 100, issues: [], notApplicableReason: null },
      { category: "send_readiness", score: 0, issues: ["This bundle is still a draft."], notApplicableReason: null },
    ],
    overallScore: 75,
    evaluatedAt,
    ...overrides,
  };
}

function makeDocumentHealth(overrides: Partial<ComposedDocumentHealth> = {}): ComposedDocumentHealth {
  return {
    categories: [
      { category: "completeness", score: 100, issues: [], notApplicableReason: null },
      { category: "context_link", score: 100, issues: [], notApplicableReason: null },
      { category: "versioning", score: 0, issues: ["This document has never been published to an immutable version."], notApplicableReason: null },
    ],
    overallScore: 67,
    evaluatedAt,
    ...overrides,
  };
}

describe("documentPlatformRecommendationsForExecutiveDecisions", () => {
  it("flags a bundle with an unavailable item", () => {
    const bundleInputs: DocumentBundleHealthInput[] = [
      {
        bundle: makeBundle(),
        health: makeBundleHealth({
          categories: [
            { category: "completeness", score: 100, issues: [], notApplicableReason: null },
            { category: "items_availability", score: 0, issues: ["No longer available is no longer available."], notApplicableReason: null },
            { category: "client_link", score: 100, issues: [], notApplicableReason: null },
            { category: "send_readiness", score: 100, issues: [], notApplicableReason: null },
          ],
        }),
      },
    ];
    const recommendations = documentPlatformRecommendationsForExecutiveDecisions(bundleInputs, []);
    expect(recommendations.some((r) => r.ruleId === "document_bundle_unavailable_items")).toBe(true);
  });

  it("flags a bundle stuck in draft with real items", () => {
    const bundleInputs: DocumentBundleHealthInput[] = [{ bundle: makeBundle(), health: makeBundleHealth() }];
    const recommendations = documentPlatformRecommendationsForExecutiveDecisions(bundleInputs, []);
    expect(recommendations.some((r) => r.ruleId === "document_bundle_stuck_in_draft")).toBe(true);
  });

  it("never flags a draft bundle with no items", () => {
    const bundleInputs: DocumentBundleHealthInput[] = [{ bundle: makeBundle({ items: [] }), health: makeBundleHealth() }];
    const recommendations = documentPlatformRecommendationsForExecutiveDecisions(bundleInputs, []);
    expect(recommendations.some((r) => r.ruleId === "document_bundle_stuck_in_draft")).toBe(false);
  });

  it("never flags a bundle that's already sent", () => {
    const bundleInputs: DocumentBundleHealthInput[] = [
      {
        bundle: makeBundle({ status: "sent" }),
        health: makeBundleHealth({
          categories: [
            { category: "completeness", score: 100, issues: [], notApplicableReason: null },
            { category: "items_availability", score: 100, issues: [], notApplicableReason: null },
            { category: "client_link", score: 100, issues: [], notApplicableReason: null },
            { category: "send_readiness", score: 100, issues: [], notApplicableReason: null },
          ],
        }),
      },
    ];
    const recommendations = documentPlatformRecommendationsForExecutiveDecisions(bundleInputs, []);
    expect(recommendations).toEqual([]);
  });

  it("flags many unpublished documents once the threshold is reached", () => {
    const documentHealths = Array.from({ length: 5 }, () => makeDocumentHealth());
    const recommendations = documentPlatformRecommendationsForExecutiveDecisions([], documentHealths);
    expect(recommendations.some((r) => r.ruleId === "document_platform_many_unpublished_documents")).toBe(true);
  });

  it("stays silent below the unpublished-documents threshold", () => {
    const documentHealths = Array.from({ length: 4 }, () => makeDocumentHealth());
    const recommendations = documentPlatformRecommendationsForExecutiveDecisions([], documentHealths);
    expect(recommendations.some((r) => r.ruleId === "document_platform_many_unpublished_documents")).toBe(false);
  });

  it("returns no recommendations for an entirely healthy workspace", () => {
    const recommendations = documentPlatformRecommendationsForExecutiveDecisions([], [makeDocumentHealth({ categories: [{ category: "versioning", score: 100, issues: [], notApplicableReason: null }] })]);
    expect(recommendations).toEqual([]);
  });
});
