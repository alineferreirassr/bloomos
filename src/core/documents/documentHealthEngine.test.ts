import { describe, it, expect } from "vitest";
import { computeComposedDocumentHealth, computeDocumentBundleHealth, summarizeDocumentPlatformHealth } from "@/core/documents/documentHealthEngine";
import type { ComposedDocument, DocumentBundle, ResolvedDocumentBundleItem } from "@/types/documentPlatform";

const evaluatedAt = new Date().toISOString();

function makeDocument(overrides: Partial<ComposedDocument> = {}): ComposedDocument {
  return {
    id: "doc_1",
    workspaceId: "ws_1",
    templateId: "template_1",
    documentTypeId: "welcome_guide",
    status: "published",
    content: [{ id: "b1", type: "paragraph", runs: [{ text: "Hello" }] }],
    mergeContext: { workspaceId: "ws_1", memberId: "member_1", clientId: "client_1" },
    metadata: { title: "Welcome Guide", description: "A guide", tags: [], clientName: "Jordan Ellis", eventTitle: null },
    currentVersion: 1,
    createdBy: "member_1",
    createdAt: evaluatedAt,
    updatedAt: evaluatedAt,
    ...overrides,
  };
}

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

describe("computeComposedDocumentHealth", () => {
  it("scores completeness highly for a fully-filled document", () => {
    const health = computeComposedDocumentHealth(makeDocument(), evaluatedAt);
    const completeness = health.categories.find((c) => c.category === "completeness");
    expect(completeness?.score).toBe(100);
  });

  it("flags a missing title in completeness issues", () => {
    const health = computeComposedDocumentHealth(makeDocument({ metadata: { title: "", description: "A guide", tags: [], clientName: "Jordan Ellis", eventTitle: null } }), evaluatedAt);
    const completeness = health.categories.find((c) => c.category === "completeness");
    expect(completeness?.issues.some((i) => i.toLowerCase().includes("title"))).toBe(true);
  });

  it("scores context_link at 0 when neither client nor event is linked", () => {
    const health = computeComposedDocumentHealth(makeDocument({ metadata: { title: "Welcome Guide", description: "A guide", tags: [], clientName: null, eventTitle: null } }), evaluatedAt);
    const contextLink = health.categories.find((c) => c.category === "context_link");
    expect(contextLink?.score).toBe(0);
  });

  it("scores versioning at 0 for a draft that has never been published", () => {
    const health = computeComposedDocumentHealth(makeDocument({ status: "draft", currentVersion: 0 }), evaluatedAt);
    const versioning = health.categories.find((c) => c.category === "versioning");
    expect(versioning?.score).toBe(0);
  });

  it("computes an overallScore as the average of every category", () => {
    const health = computeComposedDocumentHealth(makeDocument(), evaluatedAt);
    expect(health.overallScore).toBeGreaterThanOrEqual(0);
    expect(health.overallScore).toBeLessThanOrEqual(100);
    expect(health.evaluatedAt).toBe(evaluatedAt);
  });
});

describe("computeDocumentBundleHealth", () => {
  const available: ResolvedDocumentBundleItem = { item: { id: "item_1", kind: "composed_document", refId: "doc_1", addedAt: evaluatedAt }, title: "Welcome Guide", subtitle: "published", available: true };

  it("marks items_availability not applicable for an empty bundle", () => {
    const health = computeDocumentBundleHealth(makeBundle({ items: [] }), [], evaluatedAt);
    const itemsAvailability = health.categories.find((c) => c.category === "items_availability");
    expect(itemsAvailability?.score).toBeNull();
    expect(itemsAvailability?.notApplicableReason).not.toBeNull();
  });

  it("scores items_availability at 100 when every resolved item is available", () => {
    const health = computeDocumentBundleHealth(makeBundle(), [available], evaluatedAt);
    const itemsAvailability = health.categories.find((c) => c.category === "items_availability");
    expect(itemsAvailability?.score).toBe(100);
  });

  it("flags an unavailable item in items_availability issues", () => {
    const unavailable: ResolvedDocumentBundleItem = { item: { id: "item_2", kind: "proposal", refId: "prop_1", addedAt: evaluatedAt }, title: "No longer available", subtitle: null, available: false };
    const health = computeDocumentBundleHealth(makeBundle({ items: [available.item, unavailable.item] }), [available, unavailable], evaluatedAt);
    const itemsAvailability = health.categories.find((c) => c.category === "items_availability");
    expect(itemsAvailability?.issues.length).toBe(1);
  });

  it("scores client_link at 0 when no client is linked", () => {
    const health = computeDocumentBundleHealth(makeBundle({ clientId: null }), [available], evaluatedAt);
    const clientLink = health.categories.find((c) => c.category === "client_link");
    expect(clientLink?.score).toBe(0);
  });

  it("scores send_readiness at 100 once a bundle leaves draft", () => {
    const health = computeDocumentBundleHealth(makeBundle({ status: "ready" }), [available], evaluatedAt);
    const sendReadiness = health.categories.find((c) => c.category === "send_readiness");
    expect(sendReadiness?.score).toBe(100);
  });

  it("scores send_readiness at 0 while still a draft", () => {
    const health = computeDocumentBundleHealth(makeBundle({ status: "draft" }), [available], evaluatedAt);
    const sendReadiness = health.categories.find((c) => c.category === "send_readiness");
    expect(sendReadiness?.score).toBe(0);
  });
});

describe("summarizeDocumentPlatformHealth", () => {
  const available: ResolvedDocumentBundleItem = { item: { id: "item_1", kind: "composed_document", refId: "doc_1", addedAt: evaluatedAt }, title: "Welcome Guide", subtitle: "published", available: true };

  it("returns a null overallScore and no issues when nothing has been scored yet", () => {
    const summary = summarizeDocumentPlatformHealth([], []);
    expect(summary.overallScore).toBeNull();
    expect(summary.issues).toEqual([]);
  });

  it("averages every category across both documents and bundles, and flattens their issues", () => {
    const documentHealth = computeComposedDocumentHealth(makeDocument(), evaluatedAt);
    const bundleHealth = computeDocumentBundleHealth(makeBundle({ status: "draft" }), [available], evaluatedAt);
    const summary = summarizeDocumentPlatformHealth([documentHealth], [bundleHealth]);
    expect(summary.overallScore).not.toBeNull();
    expect(summary.overallScore).toBeGreaterThanOrEqual(0);
    expect(summary.overallScore).toBeLessThanOrEqual(100);
    expect(summary.issues).toContain("This bundle is still a draft.");
  });
});
