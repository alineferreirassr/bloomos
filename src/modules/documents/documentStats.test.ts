import { describe, expect, it } from "vitest";
import { computeDocumentOwnerSummary, computeDocumentWorkspaceSummary } from "@/modules/documents/documentStats";
import type { Document } from "@/types/document";

function doc(overrides: Partial<Document> & { id: string }): Document {
  return {
    workspace_id: "ws_1",
    owner_type: "client",
    owner_id: "client_1",
    folder_id: null,
    title: "Doc",
    description: null,
    category: "other",
    status: "active",
    visibility: "internal",
    media_asset_id: null,
    file_name: "doc.pdf",
    original_file_name: "doc.pdf",
    file_extension: "pdf",
    mime_type: "application/pdf",
    size_bytes: 1000,
    storage_provider: "mock",
    storage_bucket: "documents",
    storage_path: "ws_1/client/client_1/doc.pdf",
    checksum: "mock_1",
    version: 1,
    is_latest_version: true,
    parent_document_id: null,
    contract_exhibit_id: null,
    event_id: null,
    client_id: null,
    contract_id: null,
    invoice_id: null,
    payment_id: null,
    expense_id: null,
    uploaded_by: null,
    uploaded_at: "2026-06-01T00:00:00.000Z",
    expires_at: null,
    archived_at: null,
    deleted_at: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

const NOW = new Date("2026-07-15T12:00:00.000Z").getTime();

describe("computeDocumentOwnerSummary", () => {
  it("counts documents by status", () => {
    const docs = [
      doc({ id: "d1", status: "active" }),
      doc({ id: "d2", status: "draft" }),
      doc({ id: "d3", status: "archived" }),
      doc({ id: "d4", status: "deleted" }),
      doc({ id: "d5", status: "expired" }),
    ];
    const summary = computeDocumentOwnerSummary(docs, NOW);
    expect(summary.total).toBe(5);
    expect(summary.active).toBe(1);
    expect(summary.draft).toBe(1);
    expect(summary.archived).toBe(1);
    expect(summary.deleted).toBe(1);
    expect(summary.expired).toBe(1);
  });

  it("sums storage size across non-deleted documents only", () => {
    const docs = [
      doc({ id: "d1", size_bytes: 1000, status: "active" }),
      doc({ id: "d2", size_bytes: 2000, status: "deleted" }),
    ];
    expect(computeDocumentOwnerSummary(docs, NOW).totalStorageBytes).toBe(1000);
  });

  it("counts an active document expiring within 14 days as expiring soon", () => {
    const soon = new Date(NOW + 5 * 24 * 60 * 60 * 1000).toISOString();
    const docs = [doc({ id: "d1", status: "active", expires_at: soon })];
    expect(computeDocumentOwnerSummary(docs, NOW).expiringSoon).toBe(1);
  });

  it("does not count a document expiring in 60 days as expiring soon", () => {
    const farFuture = new Date(NOW + 60 * 24 * 60 * 60 * 1000).toISOString();
    const docs = [doc({ id: "d1", status: "active", expires_at: farFuture })];
    expect(computeDocumentOwnerSummary(docs, NOW).expiringSoon).toBe(0);
  });

  it("buckets by category", () => {
    const docs = [doc({ id: "d1", category: "contract" }), doc({ id: "d2", category: "contract" }), doc({ id: "d3", category: "insurance" })];
    const summary = computeDocumentOwnerSummary(docs, NOW);
    expect(summary.byCategory.contract).toBe(2);
    expect(summary.byCategory.insurance).toBe(1);
    expect(summary.byCategory.other).toBe(0);
  });

  it("returns the 5 most recently uploaded documents, newest first", () => {
    const docs = Array.from({ length: 7 }, (_, i) =>
      doc({ id: `d${i}`, uploaded_at: `2026-06-0${i + 1}T00:00:00.000Z` }),
    );
    const summary = computeDocumentOwnerSummary(docs, NOW);
    expect(summary.latestUploads).toHaveLength(5);
    expect(summary.latestUploads[0].id).toBe("d6");
  });
});

describe("computeDocumentWorkspaceSummary", () => {
  it("counts documents uploaded in the current month", () => {
    const docs = [
      doc({ id: "d1", uploaded_at: "2026-07-01T00:00:00.000Z" }),
      doc({ id: "d2", uploaded_at: "2026-06-30T00:00:00.000Z" }),
    ];
    expect(computeDocumentWorkspaceSummary(docs, NOW).uploadedThisMonth).toBe(1);
  });

  it("buckets by owner type", () => {
    const docs = [
      doc({ id: "d1", owner_type: "client" }),
      doc({ id: "d2", owner_type: "event" }),
      doc({ id: "d3", owner_type: "client" }),
    ];
    const summary = computeDocumentWorkspaceSummary(docs, NOW);
    expect(summary.byOwnerType.client).toBe(2);
    expect(summary.byOwnerType.event).toBe(1);
  });

  it("buckets by visibility", () => {
    const docs = [doc({ id: "d1", visibility: "client" }), doc({ id: "d2", visibility: "internal" })];
    const summary = computeDocumentWorkspaceSummary(docs, NOW);
    expect(summary.byVisibility.client).toBe(1);
    expect(summary.byVisibility.internal).toBe(1);
  });
});
