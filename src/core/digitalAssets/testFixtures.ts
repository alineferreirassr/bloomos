import type { MediaAsset } from "@/types/mediaAsset";

/** Test-only fixture builder shared across this checkpoint's own engine test suites — never imported from production code. */
export function buildTestAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "asset_1",
    workspace_id: "ws_1",
    owner_type: "workspace",
    owner_id: "ws_1",
    original_filename: "photo.jpg",
    stored_filename: "photo_stored.jpg",
    storage_bucket: "assets",
    storage_path: "ws_1/photo.jpg",
    mime_type: "image/jpeg",
    extension: "jpg",
    file_size: 1024,
    checksum: "abc123",
    width: 800,
    height: 600,
    duration: null,
    version: 1,
    uploaded_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    folder_id: null,
    tags: [],
    color_label: null,
    priority: null,
    ai_ready: false,
    status: "pending",
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    version_notes: null,
    metadata: { pages: null, author: null, license: null, brand: null, colorProfile: null, cameraData: null, location: null, custom: {} },
    ...overrides,
  };
}
