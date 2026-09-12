import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createInspirationItemAction,
  updateInspirationItemAction,
  getInspirationItemAction,
  listInspirationItemsAction,
  archiveInspirationItemAction,
  unarchiveInspirationItemAction,
  listInspirationMediaAssetOptionsAction,
  type InspirationItemActionInput,
} from "@/modules/inspiration/inspirationActions";
import { resetInspirationItemsStore } from "@/lib/data/mock/inspirationItemsStore";
import { writeMediaAssets, resetMediaAssetsStore } from "@/lib/data/mock/mediaAssetsStore";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import type { MediaAsset } from "@/types/mediaAsset";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_WORKSPACE = "ws_other_tenant";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: ACTOR_ID, email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["social.view", "social.create", "social.publish"],
  workspaceDisplayName: "Amoré Bloom",
};

const otherWorkspaceSession: MemberSessionSnapshot = {
  ...session,
  workspace: { id: OTHER_WORKSPACE, name: "Other Workspace" },
  membership: { id: "member_other", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
};

const viewOnlySession: MemberSessionSnapshot = { ...session, permissions: ["social.view"] };
const noPermissionSession: MemberSessionSnapshot = { ...session, permissions: [] };

function baseInput(overrides: Partial<InspirationItemActionInput> = {}): InspirationItemActionInput {
  return {
    title: "A great Reel idea",
    source_type: "manual",
    source_url: null,
    creator_name: null,
    creator_handle: null,
    platform_content_id: null,
    content_format: null,
    hook: null,
    cta: null,
    why_it_works: null,
    notes: null,
    duration_seconds: null,
    published_at: null,
    media_asset_id: null,
    ...overrides,
  };
}

function mediaAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "asset_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "workspace",
    owner_id: CURRENT_WORKSPACE_ID,
    original_filename: "photo.jpg",
    stored_filename: "photo_stored.jpg",
    storage_bucket: "media",
    storage_path: "path/photo.jpg",
    mime_type: "image/jpeg",
    extension: "jpg",
    file_size: 1000,
    checksum: "abc",
    width: null,
    height: null,
    duration: null,
    version: 1,
    uploaded_by: "member_1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
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

beforeEach(() => {
  resetInspirationItemsStore();
  resetMediaAssetsStore();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Inspiration actions — access control", () => {
  it("createInspirationItemAction requires social.create", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await createInspirationItemAction(baseInput());
    expect(result.success).toBe(false);
  });

  it("createInspirationItemAction denies a member with no permissions at all", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionSession);
    const result = await createInspirationItemAction(baseInput());
    expect(result.success).toBe(false);
  });

  it("listInspirationItemsAction requires social.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionSession);
    const result = await listInspirationItemsAction();
    expect(result.success).toBe(false);
  });

  it("listInspirationItemsAction succeeds for a view-only member (read, not write)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await listInspirationItemsAction();
    expect(result.success).toBe(true);
  });

  it("denies an unauthenticated/inactive session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" } as never);
    const result = await createInspirationItemAction(baseInput());
    expect(result.success).toBe(false);
  });

  it("archiveInspirationItemAction and unarchiveInspirationItemAction require social.create", async () => {
    const created = await createInspirationItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const archived = await archiveInspirationItemAction(created.data.id);
    expect(archived.success).toBe(false);
    const unarchived = await unarchiveInspirationItemAction(created.data.id);
    expect(unarchived.success).toBe(false);
  });
});

describe("Inspiration actions — workspace and actor derivation", () => {
  it("derives workspace_id from the session, never from caller input", async () => {
    const result = await createInspirationItemAction({ ...baseInput(), workspace_id: "attacker_workspace" } as never);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.workspace_id).toBe(CURRENT_WORKSPACE_ID);
  });

  it("stores created_by as the session's own auth user UUID", async () => {
    const result = await createInspirationItemAction(baseInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.created_by).toBe(ACTOR_ID);
  });
});

describe("Inspiration actions — create validation", () => {
  it("accepts a manual reference with no URL", async () => {
    const result = await createInspirationItemAction(baseInput({ source_type: "manual", source_url: null }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_url).toBeNull();
    expect(result.data.normalized_source_url).toBeNull();
  });

  it("normalizes a valid URL server-side, stripping tracking params and lowercasing the hostname", async () => {
    const result = await createInspirationItemAction(baseInput({ source_type: "instagram", source_url: "https://Instagram.com/reel/ABC123/?utm_source=ig" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.normalized_source_url).toBe("https://instagram.com/reel/ABC123");
  });

  it("never trusts a caller-supplied normalized_source_url — always recomputes it server-side", async () => {
    const result = await createInspirationItemAction({
      ...baseInput({ source_type: "instagram", source_url: "https://instagram.com/reel/abc" }),
      normalized_source_url: "https://evil.example/hijacked",
    } as never);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.normalized_source_url).toBe("https://instagram.com/reel/abc");
  });

  it("rejects an invalid scheme in source_url", async () => {
    const result = await createInspirationItemAction(baseInput({ source_type: "other", source_url: "javascript:alert(1)" }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid source_type", async () => {
    const result = await createInspirationItemAction(baseInput({ source_type: "bogus" as never }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid content_format", async () => {
    const result = await createInspirationItemAction(baseInput({ content_format: "bogus" as never }));
    expect(result.success).toBe(false);
  });

  it("accepts a null content_format", async () => {
    const result = await createInspirationItemAction(baseInput({ content_format: null }));
    expect(result.success).toBe(true);
  });

  it("rejects a negative duration", async () => {
    const result = await createInspirationItemAction(baseInput({ duration_seconds: -5 }));
    expect(result.success).toBe(false);
  });

  it("accepts a real zero duration", async () => {
    const result = await createInspirationItemAction(baseInput({ duration_seconds: 0 }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.duration_seconds).toBe(0);
  });

  it("rejects a malformed published_at", async () => {
    const result = await createInspirationItemAction(baseInput({ published_at: "not-a-real-date" }));
    expect(result.success).toBe(false);
  });

  it("accepts a valid published_at", async () => {
    const result = await createInspirationItemAction(baseInput({ published_at: "2026-01-01T00:00:00Z" }));
    expect(result.success).toBe(true);
  });

  it("rejects an empty/blank title", async () => {
    const result = await createInspirationItemAction(baseInput({ title: "   " }));
    expect(result.success).toBe(false);
  });
});

describe("Inspiration actions — MediaAsset reference validation", () => {
  it("rejects a media_asset_id belonging to a different workspace", async () => {
    writeMediaAssets([mediaAsset({ id: "asset_other_ws", workspace_id: OTHER_WORKSPACE })]);
    const result = await createInspirationItemAction(baseInput({ media_asset_id: "asset_other_ws" }));
    expect(result.success).toBe(false);
  });

  it("rejects a media_asset_id that does not exist at all", async () => {
    const result = await createInspirationItemAction(baseInput({ media_asset_id: "does_not_exist" }));
    expect(result.success).toBe(false);
  });

  it("accepts a same-workspace media asset even while its status is 'pending' — no approval gate for Inspiration", async () => {
    writeMediaAssets([mediaAsset({ id: "asset_pending", workspace_id: CURRENT_WORKSPACE_ID, status: "pending" })]);
    const result = await createInspirationItemAction(baseInput({ media_asset_id: "asset_pending" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.media_asset_id).toBe("asset_pending");
  });

  it("revalidates ownership when media_asset_id changes on update", async () => {
    const created = await createInspirationItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");
    writeMediaAssets([mediaAsset({ id: "asset_other_ws", workspace_id: OTHER_WORKSPACE })]);

    const updated = await updateInspirationItemAction(created.data.id, { media_asset_id: "asset_other_ws" });
    expect(updated.success).toBe(false);
  });
});

describe("Inspiration actions — duplicate detection", () => {
  it("rejects a second create with the same normalized URL, with a controlled (non-raw) error", async () => {
    await createInspirationItemAction(baseInput({ source_type: "instagram", source_url: "https://instagram.com/reel/abc" }));
    const second = await createInspirationItemAction(baseInput({ source_type: "instagram", source_url: "https://instagram.com/reel/abc" }));
    expect(second.success).toBe(false);
    if (second.success) return;
    expect(second.error).not.toMatch(/23505|constraint|postgres/i);
  });

  it("rejects a second create with the same (source_type, platform_content_id)", async () => {
    await createInspirationItemAction(baseInput({ source_type: "tiktok", platform_content_id: "vid_1" }));
    const second = await createInspirationItemAction(baseInput({ source_type: "tiktok", platform_content_id: "vid_1" }));
    expect(second.success).toBe(false);
  });
});

describe("Inspiration actions — cross-workspace isolation", () => {
  it("updateInspirationItemAction rejects an item owned by a different workspace", async () => {
    const created = await createInspirationItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await updateInspirationItemAction(created.data.id, { title: "Hijacked" });
    expect(result.success).toBe(false);
  });

  it("archiveInspirationItemAction rejects an item owned by a different workspace", async () => {
    const created = await createInspirationItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await archiveInspirationItemAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("unarchiveInspirationItemAction rejects an item owned by a different workspace", async () => {
    const created = await createInspirationItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await unarchiveInspirationItemAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("getInspirationItemAction never leaks a different workspace's item", async () => {
    const created = await createInspirationItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await getInspirationItemAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("listInspirationItemsAction never returns another workspace's items", async () => {
    await createInspirationItemAction(baseInput({ title: "Mine" }));

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await listInspirationItemsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });
});

describe("Inspiration actions — update / archive / unarchive lifecycle", () => {
  it("updates only the provided fields", async () => {
    const created = await createInspirationItemAction(baseInput({ title: "Original", notes: "Keep me" }));
    if (!created.success) throw new Error("setup failed");

    const updated = await updateInspirationItemAction(created.data.id, { title: "Updated" });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.title).toBe("Updated");
    expect(updated.data.notes).toBe("Keep me");
  });

  it("returns not-found when updating an id that does not exist", async () => {
    const result = await updateInspirationItemAction("nope", { title: "X" });
    expect(result.success).toBe(false);
  });

  it("archives then unarchives an item — never deletes it", async () => {
    const created = await createInspirationItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    const archived = await archiveInspirationItemAction(created.data.id);
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.archived_at).not.toBeNull();

    const unarchived = await unarchiveInspirationItemAction(created.data.id);
    expect(unarchived.success).toBe(true);
    if (unarchived.success) expect(unarchived.data.archived_at).toBeNull();

    const stillThere = await getInspirationItemAction(created.data.id);
    expect(stillThere.success).toBe(true);
  });

  it("listInspirationItemsAction excludes archived items by default", async () => {
    const created = await createInspirationItemAction(baseInput({ title: "Will archive" }));
    if (!created.success) throw new Error("setup failed");
    await archiveInspirationItemAction(created.data.id);

    const result = await listInspirationItemsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });
});

describe("SOCIAL-06E — updateInspirationItemAction archived-edit gate", () => {
  it("rejects an update against an archived item — matches the Workflow/Template/Service/MediaAsset 'restore first' precedent", async () => {
    const created = await createInspirationItemAction(baseInput({ title: "Will archive" }));
    if (!created.success) throw new Error("setup failed");
    await archiveInspirationItemAction(created.data.id);

    const result = await updateInspirationItemAction(created.data.id, { title: "Should not apply" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/restore it first/i);

    const stillArchived = await getInspirationItemAction(created.data.id);
    expect(stillArchived.success).toBe(true);
    if (stillArchived.success) expect(stillArchived.data.title).toBe("Will archive");
  });

  it("allows a normal edit again once the item is restored", async () => {
    const created = await createInspirationItemAction(baseInput({ title: "Will archive" }));
    if (!created.success) throw new Error("setup failed");
    await archiveInspirationItemAction(created.data.id);
    await unarchiveInspirationItemAction(created.data.id);

    const result = await updateInspirationItemAction(created.data.id, { title: "Updated after restore" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Updated after restore");
  });
});

describe("SOCIAL-06E — listInspirationMediaAssetOptionsAction", () => {
  it("requires social.create", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await listInspirationMediaAssetOptionsAction();
    expect(result.success).toBe(false);
  });

  it("returns the caller's own workspace assets regardless of status — no approval gate", async () => {
    writeMediaAssets([
      mediaAsset({ id: "asset_pending", status: "pending" }),
      mediaAsset({ id: "asset_approved", status: "approved" }),
      mediaAsset({ id: "asset_rejected", status: "rejected" }),
    ]);

    const result = await listInspirationMediaAssetOptionsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((a) => a.id).sort()).toEqual(["asset_approved", "asset_pending", "asset_rejected"]);
  });

  it("never returns another workspace's assets", async () => {
    writeMediaAssets([mediaAsset({ id: "asset_mine" }), mediaAsset({ id: "asset_theirs", workspace_id: OTHER_WORKSPACE })]);

    const result = await listInspirationMediaAssetOptionsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((a) => a.id)).toEqual(["asset_mine"]);
  });
});
