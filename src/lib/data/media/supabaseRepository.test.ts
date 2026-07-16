import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/workspaceSessionClient", () => ({
  getClientWorkspaceSession: vi.fn(),
}));

import { supabaseMediaAssetsRepository } from "@/lib/data/media/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import { getClientWorkspaceSession } from "@/lib/auth/workspaceSessionClient";

type QueryResult = { data: unknown; error: unknown; count?: number };
type RecordedCall = { table: string; method: string; args: unknown[] };
type StorageCall = { bucket: string; method: string; args: unknown[] };

function createMockSupabase(responses: QueryResult[]) {
  const calls: RecordedCall[] = [];
  const storageCalls: StorageCall[] = [];
  let i = 0;
  function nextResult(): QueryResult {
    if (i >= responses.length) {
      throw new Error(`No mock Supabase response queued for call #${i + 1}`);
    }
    return responses[i++];
  }
  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const chain =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ table, method, args });
        return b;
      };
    b.select = chain("select");
    b.eq = chain("eq");
    b.is = chain("is");
    b.order = chain("order");
    b.insert = chain("insert");
    b.update = chain("update");
    b.delete = chain("delete");
    b.maybeSingle = async () => {
      calls.push({ table, method: "maybeSingle", args: [] });
      return nextResult();
    };
    b.single = async () => {
      calls.push({ table, method: "single", args: [] });
      return nextResult();
    };
    b.then = (resolve: (value: QueryResult) => void) => {
      calls.push({ table, method: "then", args: [] });
      resolve(nextResult());
    };
    return b;
  }
  const client = {
    from: (table: string) => builder(table),
    storage: {
      from: (bucket: string) => ({
        upload: async (...args: unknown[]) => {
          storageCalls.push({ bucket, method: "upload", args });
          return nextResult();
        },
        download: async (...args: unknown[]) => {
          storageCalls.push({ bucket, method: "download", args });
          return nextResult();
        },
        createSignedUrl: async (...args: unknown[]) => {
          storageCalls.push({ bucket, method: "createSignedUrl", args });
          return nextResult();
        },
        remove: async (...args: unknown[]) => {
          storageCalls.push({ bucket, method: "remove", args });
          return nextResult();
        },
      }),
    },
  };
  return { client, calls, storageCalls };
}

const SESSION = {
  status: "ok" as const,
  session: {
    user: { id: "user_1", email: "owner@example.com" },
    profile: {
      id: "user_1",
      full_name: "Amoré Bloom Owner",
      email: "owner@example.com",
      avatar_url: null,
      created_at: "2026-07-19T00:00:00Z",
      updated_at: "2026-07-19T00:00:00Z",
    },
    workspace: {
      id: "workspace_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-07-19T00:00:00Z",
      updated_at: "2026-07-19T00:00:00Z",
      archived_at: null,
    },
    membership: {
      id: "member_1",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "owner" as const,
      status: "active" as const,
      created_at: "2026-07-19T00:00:00Z",
      updated_at: "2026-07-19T00:00:00Z",
    },
  },
};

function mediaAssetRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "media_1",
    workspace_id: "workspace_1",
    owner_type: "event",
    owner_id: "event_1",
    original_filename: "photo.jpg",
    stored_filename: "photo.jpg",
    storage_bucket: "media-assets",
    storage_path: "workspace_1/event/event_1/media_1/v1/photo.jpg",
    mime_type: "image/jpeg",
    extension: "jpg",
    file_size: 1024,
    checksum: "sha256:abc",
    width: null,
    height: null,
    duration: null,
    version: 1,
    uploaded_by: "user_1",
    created_at: "2026-07-19T00:00:00Z",
    updated_at: "2026-07-19T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

function makeFile(content: string, name: string, type: string): File {
  return new File([content], name, { type });
}

afterEach(() => {
  vi.clearAllMocks();
});

function mockSession() {
  vi.mocked(getClientWorkspaceSession).mockResolvedValue(SESSION as never);
}

describe("supabaseMediaAssetsRepository.getMediaAssetById", () => {
  it("throws NotFoundError when the row is invisible (RLS or genuinely missing)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseMediaAssetsRepository.getMediaAssetById("nope")).rejects.toThrow("was not found");
  });

  it("returns the mapped asset when found", async () => {
    const { client } = createMockSupabase([{ data: mediaAssetRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const asset = await supabaseMediaAssetsRepository.getMediaAssetById("media_1");
    expect(asset.id).toBe("media_1");
    expect(asset.checksum).toBe("sha256:abc");
  });
});

describe("supabaseMediaAssetsRepository.getMediaAssetsByOwner", () => {
  it("scopes the query to the current Workspace and excludes archived by default", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [mediaAssetRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const assets = await supabaseMediaAssetsRepository.getMediaAssetsByOwner("event", "event_1");
    expect(assets).toHaveLength(1);
    expect(calls.some((c) => c.method === "is" && c.args[0] === "archived_at")).toBe(true);
  });
});

describe("supabaseMediaAssetsRepository.uploadMediaAsset", () => {
  it("rejects an owner type that isn't live yet", async () => {
    const result = await supabaseMediaAssetsRepository.uploadMediaAsset({
      ownerType: "contract",
      ownerId: "contract_1",
      file: makeFile("hello", "photo.jpg", "image/jpeg"),
      originalFilename: "photo.jpg",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a blocked extension before touching Supabase", async () => {
    const result = await supabaseMediaAssetsRepository.uploadMediaAsset({
      ownerType: "event",
      ownerId: "event_1",
      file: makeFile("MZ", "installer.exe", "application/octet-stream"),
      originalFilename: "installer.exe",
    });
    expect(result.success).toBe(false);
  });

  it("uploads the file to Storage, inserts the row, and logs a timeline entry against the owner", async () => {
    mockSession();
    const { client, calls, storageCalls } = createMockSupabase([
      { data: null, error: null }, // storage upload
      { data: mediaAssetRow(), error: null }, // media_assets insert
      { data: null, error: null }, // timeline_activities insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseMediaAssetsRepository.uploadMediaAsset({
      ownerType: "event",
      ownerId: "event_1",
      file: makeFile("hello media library", "photo.jpg", "image/jpeg"),
      originalFilename: "photo.jpg",
    });

    expect(result.success).toBe(true);
    expect(storageCalls[0].method).toBe("upload");
    expect(storageCalls[0].bucket).toBe("media-assets");
    const insertCall = calls.find((c) => c.table === "media_assets" && c.method === "insert");
    expect(insertCall).toBeDefined();
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect(timelineInsert).toBeDefined();
    const timelinePayload = timelineInsert?.args[0] as { owner_type: string; owner_id: string; type: string };
    expect(timelinePayload.owner_type).toBe("event");
    expect(timelinePayload.owner_id).toBe("event_1");
    expect(timelinePayload.type).toBe("media_asset_uploaded");
  });
});

describe("supabaseMediaAssetsRepository.replaceMediaAssetVersion", () => {
  it("fails when the asset is archived", async () => {
    const { client } = createMockSupabase([{ data: mediaAssetRow({ archived_at: "2026-07-19T00:00:00Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseMediaAssetsRepository.replaceMediaAssetVersion("media_1", {
      file: makeFile("v2", "photo-v2.jpg", "image/jpeg"),
      originalFilename: "photo-v2.jpg",
    });
    expect(result.success).toBe(false);
  });

  it("uploads the new version and increments version on update", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: mediaAssetRow(), error: null }, // fetchMediaAssetRow
      { data: null, error: null }, // storage upload
      { data: mediaAssetRow({ version: 2 }), error: null }, // update
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseMediaAssetsRepository.replaceMediaAssetVersion("media_1", {
      file: makeFile("v2 bytes", "photo-v2.jpg", "image/jpeg"),
      originalFilename: "photo-v2.jpg",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.version).toBe(2);

    const updateCall = calls.find((c) => c.table === "media_assets" && c.method === "update");
    const updatePayload = updateCall?.args[0] as { version: number };
    expect(updatePayload.version).toBe(2);
  });
});

describe("supabaseMediaAssetsRepository.downloadMediaAsset / getMediaAssetDownloadUrl / verifyMediaAssetChecksum", () => {
  it("downloads the blob for an existing asset", async () => {
    const blob = new Blob(["file bytes"], { type: "image/jpeg" });
    const { client, storageCalls } = createMockSupabase([
      { data: mediaAssetRow(), error: null },
      { data: blob, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseMediaAssetsRepository.downloadMediaAsset("media_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(await result.data.blob.text()).toBe("file bytes");
    expect(storageCalls[0].method).toBe("download");
  });

  it("returns a signed URL for an existing asset", async () => {
    const { client } = createMockSupabase([
      { data: mediaAssetRow(), error: null },
      { data: { signedUrl: "https://example.com/signed" }, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseMediaAssetsRepository.getMediaAssetDownloadUrl("media_1", 900);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.url).toBe("https://example.com/signed");
  });

  it("verifies checksum against re-downloaded bytes", async () => {
    const blob = new Blob(["known bytes"], { type: "text/plain" });
    const { client } = createMockSupabase([
      { data: mediaAssetRow({ checksum: "sha256:wrong" }), error: null },
      { data: blob, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseMediaAssetsRepository.verifyMediaAssetChecksum("media_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.valid).toBe(false);
    expect(result.data.expectedChecksum).toBe("sha256:wrong");
    expect(result.data.actualChecksum).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("supabaseMediaAssetsRepository.deleteMediaAsset / restoreMediaAsset", () => {
  it("archives an asset and logs a timeline entry", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: mediaAssetRow(), error: null }, // fetch
      { data: mediaAssetRow({ archived_at: "2026-07-19T01:00:00Z" }), error: null }, // update
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseMediaAssetsRepository.deleteMediaAsset("media_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.archived_at).not.toBeNull();

    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const payload = timelineInsert?.args[0] as { type: string };
    expect(payload.type).toBe("media_asset_archived");
  });

  it("fails to archive an already-archived asset", async () => {
    const { client } = createMockSupabase([{ data: mediaAssetRow({ archived_at: "2026-07-19T00:00:00Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseMediaAssetsRepository.deleteMediaAsset("media_1");
    expect(result.success).toBe(false);
  });

  it("restores an archived asset and logs a timeline entry", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: mediaAssetRow({ archived_at: "2026-07-19T00:00:00Z" }), error: null }, // fetch
      { data: mediaAssetRow({ archived_at: null }), error: null }, // update
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseMediaAssetsRepository.restoreMediaAsset("media_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.archived_at).toBeNull();

    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    const payload = timelineInsert?.args[0] as { type: string };
    expect(payload.type).toBe("media_asset_restored");
  });

  it("fails to restore a non-archived asset", async () => {
    const { client } = createMockSupabase([{ data: mediaAssetRow({ archived_at: null }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseMediaAssetsRepository.restoreMediaAsset("media_1");
    expect(result.success).toBe(false);
  });
});
