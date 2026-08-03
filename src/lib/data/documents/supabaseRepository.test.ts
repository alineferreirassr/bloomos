import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/workspaceSessionClient", () => ({
  getClientWorkspaceSession: vi.fn(),
}));

import { supabaseDocumentsRepository } from "@/lib/data/documents/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import { getClientWorkspaceSession } from "@/lib/auth/workspaceSessionClient";

type QueryResult = { data: unknown; error: unknown; count?: number };
type RecordedCall = { table: string; method: string; args: unknown[] };

function createMockSupabase(responses: QueryResult[]) {
  const calls: RecordedCall[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];
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
    b.neq = chain("neq");
    b.gte = chain("gte");
    b.lte = chain("lte");
    b.is = chain("is");
    b.in = chain("in");
    b.or = chain("or");
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
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return nextResult();
    },
  };
  return { client, calls, rpcCalls };
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
      created_at: "2026-07-18T00:00:00Z",
      updated_at: "2026-07-18T00:00:00Z",
    },
    workspace: {
      id: "workspace_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-07-18T00:00:00Z",
      updated_at: "2026-07-18T00:00:00Z",
      archived_at: null,
    },
    membership: {
      id: "member_1",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "owner" as const,
      status: "active" as const,
      created_at: "2026-07-18T00:00:00Z",
      updated_at: "2026-07-18T00:00:00Z",
    },
  },
};

function mockSession() {
  vi.mocked(getClientWorkspaceSession).mockResolvedValue(SESSION as never);
}

function documentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "document_1",
    workspace_id: "workspace_1",
    owner_type: "contract",
    owner_id: "contract_1",
    folder_id: null,
    title: "Vendor Insurance Certificate",
    description: null,
    category: "insurance",
    status: "draft",
    visibility: "internal",
    media_asset_id: null,
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
    uploaded_by: "user_1",
    uploaded_at: "2026-07-16T00:00:00Z",
    expires_at: null,
    archived_at: null,
    deleted_at: null,
    created_at: "2026-07-16T00:00:00Z",
    updated_at: "2026-07-16T00:00:00Z",
    ...overrides,
  };
}

function mediaAssetRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "media_1",
    workspace_id: "workspace_1",
    owner_type: "document",
    owner_id: "document_1",
    stored_filename: "certificate.pdf",
    original_filename: "certificate.pdf",
    extension: "pdf",
    mime_type: "application/pdf",
    file_size: 12345,
    storage_bucket: "media-assets",
    storage_path: "workspace_1/document/document_1/media_1/v1/certificate.pdf",
    checksum: "abc123",
    version: 1,
    archived_at: null,
    created_at: "2026-07-16T00:00:00Z",
    updated_at: "2026-07-16T00:00:00Z",
    ...overrides,
  };
}

function documentFolderRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "docfolder_1",
    workspace_id: "workspace_1",
    owner_type: "client",
    owner_id: "client_1",
    parent_folder_id: null,
    name: "Contracts",
    description: null,
    sort_order: 0,
    visibility: "internal",
    created_at: "2026-07-16T00:00:00Z",
    updated_at: "2026-07-16T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

const METADATA_INPUT = {
  owner_type: "contract" as const,
  owner_id: "contract_1",
  folder_id: null,
  title: "Vendor Insurance Certificate",
  description: null,
  category: "insurance" as const,
  visibility: "internal" as const,
  media_asset_id: null,
  expires_at: null,
  uploaded_by: null,
  contract_exhibit_id: null,
  event_id: null,
  client_id: null,
  contract_id: null,
  invoice_id: null,
  payment_id: null,
  expense_id: null,
};

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

describe("supabaseDocumentsRepository.getDocuments", () => {
  it("scopes the query to the current Workspace, excludes archived/deleted by default, and hydrates linked MediaAssets", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: [documentRow({ media_asset_id: "media_1" })], error: null },
      { data: [mediaAssetRow()], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const documents = await supabaseDocumentsRepository.getDocuments();

    expect(documents).toHaveLength(1);
    expect(documents[0].original_file_name).toBe("certificate.pdf");
    const eqWorkspace = calls.find((c) => c.table === "documents" && c.method === "eq" && c.args[0] === "workspace_id");
    expect(eqWorkspace?.args[1]).toBe("workspace_1");
    expect(calls.some((c) => c.method === "neq" && c.args[0] === "status" && c.args[1] === "archived")).toBe(true);
    expect(calls.some((c) => c.method === "neq" && c.args[0] === "status" && c.args[1] === "deleted")).toBe(true);
  });

  it("returns metadata-only documents (file_name/size_bytes null) when no MediaAsset is linked", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: [documentRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const documents = await supabaseDocumentsRepository.getDocuments();

    expect(documents[0].file_name).toBeNull();
    expect(documents[0].size_bytes).toBeNull();
  });
});

describe("supabaseDocumentsRepository.getDocumentById", () => {
  it("returns the mapped document when found", async () => {
    const { client } = createMockSupabase([{ data: documentRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const document = await supabaseDocumentsRepository.getDocumentById("document_1");
    expect(document.id).toBe("document_1");
  });

  it("throws NotFoundError when the document doesn't exist (or belongs to another Workspace, per RLS)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseDocumentsRepository.getDocumentById("missing")).rejects.toThrow("was not found");
  });
});

describe("supabaseDocumentsRepository.createDocumentMetadata", () => {
  it("returns a validation failure without touching Supabase when input is invalid", async () => {
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.createDocumentMetadata({ ...METADATA_INPUT, owner_id: "" });
    expect(result.success).toBe(false);
  });

  it("fails when owner_id doesn't reference a real (Workspace-visible) row", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.createDocumentMetadata(METADATA_INPUT);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.fieldErrors?.owner_id).toBe("Contract not found.");
  });

  it("fails when media_asset_id doesn't reference a real MediaAsset", async () => {
    mockSession();
    const { client } = createMockSupabase([
      { data: { id: "contract_1" }, error: null }, // owner existence check
      { data: null, error: null }, // media_assets lookup
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.createDocumentMetadata({ ...METADATA_INPUT, media_asset_id: "media_missing" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.fieldErrors?.media_asset_id).toBe("MediaAsset not found.");
  });

  it("inserts scoped to the session Workspace, defaults status to draft, and records document_created", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: { id: "contract_1" }, error: null }, // owner existence check
      { data: documentRow(), error: null }, // insert (media_asset_id null -> hydration skips a media_assets query)
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.createDocumentMetadata(METADATA_INPUT);

    expect(result.success).toBe(true);
    const insertCall = calls.find((c) => c.table === "documents" && c.method === "insert");
    expect((insertCall?.args[0] as Record<string, unknown>).status).toBe("draft");
    expect((insertCall?.args[0] as Record<string, unknown>).workspace_id).toBe("workspace_1");
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("document_created");
  });
});

describe("supabaseDocumentsRepository.updateDocumentMetadata", () => {
  it("fails when the document does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.updateDocumentMetadata("missing", {
      title: "New Title",
      description: null,
      category: "other",
      expires_at: null,
    });
    expect(result.success).toBe(false);
  });

  it("is read-only once soft-deleted", async () => {
    const { client } = createMockSupabase([{ data: documentRow({ status: "deleted" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.updateDocumentMetadata("document_1", {
      title: "New Title",
      description: null,
      category: "other",
      expires_at: null,
    });
    expect(result.success).toBe(false);
  });

  it("links a MediaAsset via an optional media_asset_id patch and records document_metadata_updated", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: documentRow(), error: null }, // fetchDocumentRow (existing)
      { data: mediaAssetRow(), error: null }, // media_assets existence check for the new link
      { data: documentRow({ media_asset_id: "media_1" }), error: null }, // update
      { data: mediaAssetRow(), error: null }, // hydrate updated row
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.updateDocumentMetadata("document_1", {
      title: "Vendor Insurance Certificate",
      description: null,
      category: "insurance",
      expires_at: null,
      media_asset_id: "media_1",
    });

    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "documents" && c.method === "update");
    expect((updateCall?.args[0] as Record<string, unknown>).media_asset_id).toBe("media_1");
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("document_metadata_updated");
  });
});

describe("supabaseDocumentsRepository status transitions", () => {
  it("activateDocument rejects an illegal transition", async () => {
    // superseded can only move to archived/deleted, never back to active.
    const { client } = createMockSupabase([{ data: documentRow({ status: "superseded" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.activateDocument("document_1");
    expect(result.success).toBe(false);
  });

  it("activateDocument sets status=active and records document_activated", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: documentRow({ status: "draft" }), error: null },
      { data: documentRow({ status: "active" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.activateDocument("document_1");

    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "documents" && c.method === "update");
    expect((updateCall?.args[0] as Record<string, unknown>).status).toBe("active");
  });

  it("archiveDocument stamps archived_at and records document_archived", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: documentRow({ status: "active" }), error: null },
      { data: documentRow({ status: "archived", archived_at: "2026-07-16T00:00:00Z" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.archiveDocument("document_1");

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("document_archived");
  });

  it("restoreDocument returns to active and clears archived_at/deleted_at", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: documentRow({ status: "archived", archived_at: "2026-07-16T00:00:00Z" }), error: null },
      { data: documentRow({ status: "active", archived_at: null }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.restoreDocument("document_1");

    expect(result.success).toBe(true);
    const updateCall = calls.find((c) => c.table === "documents" && c.method === "update");
    expect((updateCall?.args[0] as Record<string, unknown>).archived_at).toBeNull();
  });

  it("softDeleteDocument sets status=deleted, never a hard delete call", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: documentRow({ status: "active" }), error: null },
      { data: documentRow({ status: "deleted" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.softDeleteDocument("document_1");

    expect(result.success).toBe(true);
    expect(calls.some((c) => c.table === "documents" && c.method === "delete")).toBe(false);
  });

  it("expireDocument requires an active document", async () => {
    const { client } = createMockSupabase([{ data: documentRow({ status: "draft" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.expireDocument("document_1");
    expect(result.success).toBe(false);
  });

  it("updateDocumentVisibility is blocked once soft-deleted", async () => {
    const { client } = createMockSupabase([{ data: documentRow({ status: "deleted" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.updateDocumentVisibility("document_1", "client");
    expect(result.success).toBe(false);
  });

  it("moveDocumentToFolder rejects a folder belonging to a different owner", async () => {
    const { client } = createMockSupabase([
      { data: documentRow({ owner_type: "contract", owner_id: "contract_1" }), error: null },
      { data: documentFolderRow({ owner_type: "event", owner_id: "event_1" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.moveDocumentToFolder("document_1", "docfolder_1");
    expect(result.success).toBe(false);
  });

  it("moveDocumentToFolder succeeds into a same-owner folder and records document_moved_to_folder", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: documentRow({ owner_type: "client", owner_id: "client_1" }), error: null },
      { data: documentFolderRow({ owner_type: "client", owner_id: "client_1" }), error: null },
      { data: documentRow({ owner_type: "client", owner_id: "client_1", folder_id: "docfolder_1" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.moveDocumentToFolder("document_1", "docfolder_1");

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("document_moved_to_folder");
  });
});

describe("supabaseDocumentsRepository.createDocumentVersion", () => {
  const VERSION_INPUT = { document_id: "document_1", media_asset_id: null, uploaded_by: null };

  it("returns a validation failure without touching Supabase when input is invalid", async () => {
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.createDocumentVersion({ ...VERSION_INPUT, document_id: "" });
    expect(result.success).toBe(false);
  });

  it("fails when media_asset_id doesn't reference a real MediaAsset", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.createDocumentVersion({ ...VERSION_INPUT, media_asset_id: "media_missing" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.fieldErrors?.media_asset_id).toBe("MediaAsset not found.");
  });

  it("delegates the atomic version-creation to the create_document_version RPC", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: documentRow({ id: "document_2", version: 2, parent_document_id: "document_1" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.createDocumentVersion(VERSION_INPUT);

    expect(result.success).toBe(true);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("create_document_version");
    const args = rpcCalls[0].args as Record<string, unknown>;
    expect(args.p_document_id).toBe("document_1");
    expect(args.p_media_asset_id).toBeNull();
    expect(args.p_expires_at_provided).toBe(false);
    expect(args.p_actor).toBe("Amoré Bloom Owner");
  });

  it("distinguishes an explicit null expires_at (clear) from an omitted one (inherit) via p_expires_at_provided", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([{ data: documentRow({ version: 2 }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseDocumentsRepository.createDocumentVersion({ ...VERSION_INPUT, expires_at: null });

    const args = rpcCalls[0].args as Record<string, unknown>;
    expect(args.p_expires_at_provided).toBe(true);
    expect(args.p_expires_at).toBeNull();
  });

  it("translates an application validation error (P0001-P0003) from the RPC into a DataResult failure rather than throwing", async () => {
    mockSession();
    const { client } = createMockSupabase([]);
    client.rpc = async () => ({ data: null, error: { code: "P0001", message: "This document has been deleted and cannot receive a new version." } });
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.createDocumentVersion(VERSION_INPUT);
    expect(result.success).toBe(false);
  });
});

describe("supabaseDocumentsRepository.getDocumentVersions / getLatestDocumentVersion", () => {
  it("getDocumentVersions returns [] when the anchor document doesn't exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const versions = await supabaseDocumentsRepository.getDocumentVersions("missing");
    expect(versions).toEqual([]);
  });

  it("resolves the whole chain via an .or() filter on id/parent_document_id, ordered by version ascending", async () => {
    const { client, calls } = createMockSupabase([
      { data: documentRow({ id: "document_2", parent_document_id: "document_1", version: 2 }), error: null },
      {
        data: [
          documentRow({ id: "document_1", version: 1, is_latest_version: false, status: "superseded" }),
          documentRow({ id: "document_2", parent_document_id: "document_1", version: 2 }),
        ],
        error: null,
      },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const versions = await supabaseDocumentsRepository.getDocumentVersions("document_2");

    expect(versions.map((v) => v.version)).toEqual([1, 2]);
    const orCall = calls.find((c) => c.table === "documents" && c.method === "or");
    expect(orCall?.args[0]).toContain("document_1");
  });
});

describe("supabaseDocumentsRepository attachDocumentTo*", () => {
  it("attachDocumentToClient fails when the client doesn't exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.attachDocumentToClient("document_1", "missing");
    expect(result.success).toBe(false);
  });

  it("attachDocumentToClient links a real client and records document_metadata_updated", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: { id: "client_1" }, error: null },
      { data: documentRow(), error: null },
      { data: documentRow({ client_id: "client_1" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.attachDocumentToClient("document_1", "client_1");

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("document_metadata_updated");
  });
});

// ---------------------------------------------------------------------------
// Document Folders
// ---------------------------------------------------------------------------

describe("supabaseDocumentsRepository folders CRUD", () => {
  it("getDocumentFolders scopes to the Workspace and excludes archived by default", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([{ data: [documentFolderRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const folders = await supabaseDocumentsRepository.getDocumentFolders();

    expect(folders).toHaveLength(1);
    expect(calls.some((c) => c.method === "is" && c.args[0] === "archived_at" && c.args[1] === null)).toBe(true);
  });

  it("getDocumentFolderById throws NotFoundError when missing", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseDocumentsRepository.getDocumentFolderById("missing")).rejects.toThrow("was not found");
  });

  it("createDocumentFolder rejects a parent folder belonging to a different owner", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: documentFolderRow({ owner_type: "event", owner_id: "event_1" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.createDocumentFolder({
      owner_type: "client",
      owner_id: "client_1",
      parent_folder_id: "docfolder_1",
      name: "Contracts",
      description: null,
      sort_order: 0,
      visibility: "internal",
    });
    expect(result.success).toBe(false);
  });

  it("createDocumentFolder inserts scoped to the Workspace and records document_folder_created", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: documentFolderRow(), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.createDocumentFolder({
      owner_type: "client",
      owner_id: "client_1",
      parent_folder_id: null,
      name: "Contracts",
      description: null,
      sort_order: 0,
      visibility: "internal",
    });

    expect(result.success).toBe(true);
    const insertCall = calls.find((c) => c.table === "document_folders" && c.method === "insert");
    expect((insertCall?.args[0] as Record<string, unknown>).workspace_id).toBe("workspace_1");
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("document_folder_created");
  });

  it("moveDocumentFolder prevents a cycle using the sibling folder set", async () => {
    mockSession();
    const { client } = createMockSupabase([
      { data: documentFolderRow({ id: "docfolder_1" }), error: null },
      { data: [documentFolderRow({ id: "docfolder_1" }), documentFolderRow({ id: "docfolder_2", parent_folder_id: "docfolder_1" })], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.moveDocumentFolder("docfolder_1", "docfolder_2");
    expect(result.success).toBe(false);
  });

  it("archiveDocumentFolder fails when already archived", async () => {
    const { client } = createMockSupabase([{ data: documentFolderRow({ archived_at: "2026-07-16T00:00:00Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.archiveDocumentFolder("docfolder_1");
    expect(result.success).toBe(false);
  });

  it("restoreDocumentFolder fails when not archived", async () => {
    const { client } = createMockSupabase([{ data: documentFolderRow({ archived_at: null }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.restoreDocumentFolder("docfolder_1");
    expect(result.success).toBe(false);
  });
});

describe("supabaseDocumentsRepository.applyDefaultFolderTemplate", () => {
  it("delegates atomic bulk-insert to the apply_default_folder_template RPC", async () => {
    mockSession();
    const { client, rpcCalls } = createMockSupabase([
      { data: [documentFolderRow({ id: "docfolder_1", name: "Contracts" }), documentFolderRow({ id: "docfolder_2", name: "Payments" })], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.applyDefaultFolderTemplate({
      ownerType: "client",
      ownerId: "client_1",
      templateKind: "client",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(2);
    expect(rpcCalls[0].name).toBe("apply_default_folder_template");
    const args = rpcCalls[0].args as Record<string, unknown>;
    expect(args.p_workspace_id).toBe("workspace_1");
    expect(args.p_owner_type).toBe("client");
    expect(args.p_template_kind).toBe("client");
  });
});

// ---------------------------------------------------------------------------
// Notes and Timeline
// ---------------------------------------------------------------------------

function documentNoteRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "note_1",
    workspace_id: "workspace_1",
    owner_type: "document",
    owner_id: "document_1",
    title: "Reviewed",
    content: "Looks good.",
    category: "general",
    priority: "normal",
    is_pinned: false,
    attachments: [],
    created_by: "Amoré Bloom Owner",
    created_at: "2026-07-16T00:00:00Z",
    updated_at: "2026-07-16T00:00:00Z",
    ...overrides,
  };
}

describe("supabaseDocumentsRepository Document Notes/Timeline", () => {
  it("getNotesByDocumentId returns [] when the document doesn't exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const notes = await supabaseDocumentsRepository.getNotesByDocumentId("missing");
    expect(notes).toEqual([]);
  });

  it("createDocumentNote inserts scoped to the document's Workspace and records note_added", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: documentRow(), error: null },
      { data: documentNoteRow(), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.createDocumentNote("document_1", {
      title: "Reviewed",
      content: "Looks good.",
      category: "general",
      priority: "normal",
    });

    expect(result.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("note_added");
  });

  it("togglePinDocumentNote pins an unpinned Document-owned note and records note_pinned", async () => {
    mockSession();
    const { client, calls } = createMockSupabase([
      { data: documentNoteRow({ is_pinned: false }), error: null },
      { data: documentNoteRow({ is_pinned: true }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.togglePinDocumentNote("note_1");

    expect(result).not.toBeNull();
    expect(result?.success).toBe(true);
    const timelineInsert = calls.find((c) => c.table === "timeline_activities" && c.method === "insert");
    expect((timelineInsert?.args[0] as Record<string, unknown>).type).toBe("note_pinned");
  });

  it("togglePinDocumentNote returns null when the note isn't Document-owned", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseDocumentsRepository.togglePinDocumentNote("folder_note_1");
    expect(result).toBeNull();
  });
});

describe("supabaseDocumentsRepository.getTimelineByDocumentId", () => {
  it("orders newest-first and scopes by workspace_id + owner_type='document' + owner_id", async () => {
    const activityRow = {
      id: "activity_1",
      workspace_id: "workspace_1",
      owner_type: "document",
      owner_id: "document_1",
      type: "document_created",
      description: "Document uploaded",
      actor: "Amoré Bloom Owner",
      timestamp: "2026-07-16T00:00:00Z",
      metadata: null,
    };
    const { client, calls } = createMockSupabase([
      { data: documentRow(), error: null },
      { data: [activityRow], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const timeline = await supabaseDocumentsRepository.getTimelineByDocumentId("document_1");

    expect(timeline).toHaveLength(1);
    const orderCall = calls.find((c) => c.table === "timeline_activities" && c.method === "order");
    expect(orderCall?.args).toEqual(["timestamp", { ascending: false }]);
  });
});

describe("supabaseDocumentsRepository Workspace isolation / session errors", () => {
  it("getDocuments throws Unauthorized when there is no signed-in user", async () => {
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "unauthenticated" });
    const { client } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseDocumentsRepository.getDocuments()).rejects.toThrow("Authentication is required.");
  });

  it("createDocumentMetadata throws Forbidden when the user has no active Workspace membership", async () => {
    const { client } = createMockSupabase([{ data: { id: "contract_1" }, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    vi.mocked(getClientWorkspaceSession).mockResolvedValue({ status: "no-workspace" });

    await expect(supabaseDocumentsRepository.createDocumentMetadata(METADATA_INPUT)).rejects.toThrow(
      "You don't have permission to do that.",
    );
  });
});
