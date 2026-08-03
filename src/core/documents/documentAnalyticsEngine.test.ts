import { describe, it, expect } from "vitest";
import { computeDocumentAnalytics } from "@/core/documents/documentAnalyticsEngine";
import type { ComposedDocument, DocumentBundle } from "@/types/documentPlatform";

const evaluatedAt = new Date().toISOString();

function makeDocument(overrides: Partial<ComposedDocument> = {}): ComposedDocument {
  return {
    id: "doc_1",
    workspaceId: "ws_1",
    templateId: "template_1",
    documentTypeId: "welcome_guide",
    status: "published",
    content: [],
    mergeContext: { workspaceId: "ws_1", memberId: "member_1", clientId: "client_1" },
    metadata: { title: "Welcome Guide", description: "", tags: [], clientName: "Jordan Ellis", eventTitle: null },
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
    items: [],
    createdBy: "member_1",
    createdAt: evaluatedAt,
    updatedAt: evaluatedAt,
    sentAt: null,
    ...overrides,
  };
}

describe("computeDocumentAnalytics", () => {
  it("returns all-zero counts for an empty workspace", () => {
    const analytics = computeDocumentAnalytics([], [], evaluatedAt);
    expect(analytics.totalComposedDocuments).toBe(0);
    expect(analytics.totalBundles).toBe(0);
    expect(analytics.averageItemsPerBundle).toBe(0);
    expect(analytics.evaluatedAt).toBe(evaluatedAt);
  });

  it("counts documents by status", () => {
    const analytics = computeDocumentAnalytics(
      [makeDocument({ id: "doc_1", status: "draft" }), makeDocument({ id: "doc_2", status: "published" }), makeDocument({ id: "doc_3", status: "archived" })],
      [],
      evaluatedAt,
    );
    expect(analytics.draftDocumentCount).toBe(1);
    expect(analytics.publishedDocumentCount).toBe(1);
    expect(analytics.archivedDocumentCount).toBe(1);
    expect(analytics.totalComposedDocuments).toBe(3);
  });

  it("tallies templateUsage and documentTypeUsage", () => {
    const analytics = computeDocumentAnalytics(
      [makeDocument({ id: "doc_1", templateId: "template_a" }), makeDocument({ id: "doc_2", templateId: "template_a" }), makeDocument({ id: "doc_3", templateId: "template_b" })],
      [],
      evaluatedAt,
    );
    expect(analytics.templateUsage.template_a).toBe(2);
    expect(analytics.templateUsage.template_b).toBe(1);
    expect(analytics.documentTypeUsage.welcome_guide).toBe(3);
  });

  it("counts bundles by status and computes averageItemsPerBundle", () => {
    const analytics = computeDocumentAnalytics(
      [],
      [
        makeBundle({ id: "bundle_1", status: "draft", items: [{ id: "i1", kind: "composed_document", refId: "doc_1", addedAt: evaluatedAt }] }),
        makeBundle({
          id: "bundle_2",
          status: "sent",
          items: [
            { id: "i2", kind: "composed_document", refId: "doc_2", addedAt: evaluatedAt },
            { id: "i3", kind: "contract", refId: "contract_1", addedAt: evaluatedAt },
            { id: "i4", kind: "invoice", refId: "invoice_1", addedAt: evaluatedAt },
          ],
        }),
      ],
      evaluatedAt,
    );
    expect(analytics.totalBundles).toBe(2);
    expect(analytics.bundleStatusCounts.draft).toBe(1);
    expect(analytics.bundleStatusCounts.sent).toBe(1);
    expect(analytics.bundleStatusCounts.ready).toBe(0);
    expect(analytics.averageItemsPerBundle).toBe(2);
    expect(analytics.bundleItemKindUsage.composed_document).toBe(2);
    expect(analytics.bundleItemKindUsage.contract).toBe(1);
    expect(analytics.bundleItemKindUsage.invoice).toBe(1);
  });
});
