import type { Document } from "@/types/document";
import type { DocumentFolder } from "@/types/documentFolder";

/** Test-only fixture factory — not imported by any app code. */
export function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: "document_test",
    workspace_id: "ws_test",
    owner_type: "client",
    owner_id: "client_test",
    folder_id: null,
    title: "Test Document",
    description: null,
    category: "other",
    status: "draft",
    visibility: "internal",
    media_asset_id: null,
    file_name: "test_document.pdf",
    original_file_name: "Test Document.pdf",
    file_extension: "pdf",
    mime_type: "application/pdf",
    size_bytes: 100_000,
    storage_provider: "mock",
    storage_bucket: "documents",
    storage_path: "ws_test/client/client_test/test_document.pdf",
    checksum: "mock_test",
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
    uploaded_at: "2026-01-01T00:00:00.000Z",
    expires_at: null,
    archived_at: null,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Test-only fixture factory — not imported by any app code. */
export function makeDocumentFolder(overrides: Partial<DocumentFolder> = {}): DocumentFolder {
  return {
    id: "docfolder_test",
    workspace_id: "ws_test",
    owner_type: "client",
    owner_id: "client_test",
    parent_folder_id: null,
    name: "Test Folder",
    description: null,
    sort_order: 0,
    visibility: "internal",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}
