import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createIdeaItemAction,
  updateIdeaItemAction,
  getIdeaItemAction,
  listIdeaItemsAction,
  archiveIdeaItemAction,
  unarchiveIdeaItemAction,
  listIdeaMediaAssetOptionsAction,
  type IdeaItemActionInput,
} from "@/modules/idea/ideaActions";
import { resetIdeaItemsStore } from "@/lib/data/mock/ideaItemsStore";
import { resetInspirationItemsStore } from "@/lib/data/mock/inspirationItemsStore";
import { writeMediaAssets, resetMediaAssetsStore } from "@/lib/data/mock/mediaAssetsStore";
import { createInspirationItem } from "@/lib/data";
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

function baseInput(overrides: Partial<IdeaItemActionInput> = {}): IdeaItemActionInput {
  return {
    title: "Behind the scenes at a spring wedding",
    description: "A short reel following setup to first dance.",
    source_inspiration_id: null,
    content_format: null,
    hook: null,
    cta: null,
    audience: null,
    notes: null,
    media_asset_id: null,
    priority: null,
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

async function seedInspirationItem(workspaceId: string, id = "insp_1"): Promise<string> {
  const created = await createInspirationItem({
    workspaceId,
    createdBy: ACTOR_ID,
    title: "A great Reel idea",
    sourceType: "manual",
    sourceUrl: null,
    normalizedSourceUrl: null,
    creatorName: null,
    creatorHandle: null,
    platformContentId: null,
    contentFormat: null,
    hook: null,
    cta: null,
    whyItWorks: null,
    notes: null,
    durationSeconds: null,
    publishedAt: null,
    mediaAssetId: null,
  });
  if (!created.success) throw new Error("Inspiration seed failed");
  void id;
  return created.data.id;
}

beforeEach(() => {
  resetIdeaItemsStore();
  resetInspirationItemsStore();
  resetMediaAssetsStore();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Idea actions — access control", () => {
  it("createIdeaItemAction requires social.create", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await createIdeaItemAction(baseInput());
    expect(result.success).toBe(false);
  });

  it("createIdeaItemAction denies a member with no permissions at all", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionSession);
    const result = await createIdeaItemAction(baseInput());
    expect(result.success).toBe(false);
  });

  it("listIdeaItemsAction requires social.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionSession);
    const result = await listIdeaItemsAction();
    expect(result.success).toBe(false);
  });

  it("listIdeaItemsAction succeeds for a view-only member (read, not write)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await listIdeaItemsAction();
    expect(result.success).toBe(true);
  });

  it("denies an unauthenticated/inactive session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" } as never);
    const result = await createIdeaItemAction(baseInput());
    expect(result.success).toBe(false);
  });

  it("archiveIdeaItemAction and unarchiveIdeaItemAction require social.create", async () => {
    const created = await createIdeaItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const archived = await archiveIdeaItemAction(created.data.id);
    expect(archived.success).toBe(false);
    const unarchived = await unarchiveIdeaItemAction(created.data.id);
    expect(unarchived.success).toBe(false);
  });

  it("never uses social.publish for any Idea action", async () => {
    const publishOnlySession: MemberSessionSnapshot = { ...session, permissions: ["social.publish"] };
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(publishOnlySession);
    const createResult = await createIdeaItemAction(baseInput());
    expect(createResult.success).toBe(false);
    const listResult = await listIdeaItemsAction();
    expect(listResult.success).toBe(false);
  });
});

describe("Idea actions — workspace and actor derivation", () => {
  it("derives workspace_id from the session, never from caller input", async () => {
    const result = await createIdeaItemAction({ ...baseInput(), workspace_id: "attacker_workspace" } as never);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.workspace_id).toBe(CURRENT_WORKSPACE_ID);
  });

  it("stores created_by as the session's own auth user UUID", async () => {
    const result = await createIdeaItemAction(baseInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.created_by).toBe(ACTOR_ID);
  });
});

describe("Idea actions — create validation", () => {
  it("rejects an empty/blank title", async () => {
    const result = await createIdeaItemAction(baseInput({ title: "   " }));
    expect(result.success).toBe(false);
  });

  it("rejects an empty/blank description", async () => {
    const result = await createIdeaItemAction(baseInput({ description: "   " }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid priority", async () => {
    const result = await createIdeaItemAction(baseInput({ priority: "urgent" as never }));
    expect(result.success).toBe(false);
  });

  it("accepts every valid priority value and null", async () => {
    for (const priority of ["low", "normal", "high", null] as const) {
      const result = await createIdeaItemAction(baseInput({ priority, title: `Priority ${String(priority)}` }));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.priority).toBe(priority);
    }
  });

  it("rejects an invalid content_format", async () => {
    const result = await createIdeaItemAction(baseInput({ content_format: "bogus" as never }));
    expect(result.success).toBe(false);
  });

  it("accepts every valid content_format value and null", async () => {
    for (const format of ["reel", "carousel", "story", "static", "video", "other", null] as const) {
      const result = await createIdeaItemAction(baseInput({ content_format: format, title: `Format ${String(format)}` }));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.content_format).toBe(format);
    }
  });

  it("does not impose any title uniqueness — two ideas may share a title", async () => {
    const first = await createIdeaItemAction(baseInput({ title: "Same title" }));
    const second = await createIdeaItemAction(baseInput({ title: "Same title" }));
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
  });

  it("stores plain text verbatim — no HTML execution, no dangerouslySetInnerHTML assumptions", async () => {
    const payload = "<img src=x onerror=alert(1)>";
    const result = await createIdeaItemAction(baseInput({ description: payload, notes: payload, hook: payload }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.description).toBe(payload);
    expect(result.data.notes).toBe(payload);
    expect(result.data.hook).toBe(payload);
  });
});

describe("Idea actions — Inspiration reference validation", () => {
  it("accepts a source_inspiration_id belonging to the caller's own workspace", async () => {
    const inspirationId = await seedInspirationItem(CURRENT_WORKSPACE_ID);
    const result = await createIdeaItemAction(baseInput({ source_inspiration_id: inspirationId }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_inspiration_id).toBe(inspirationId);
  });

  it("rejects a source_inspiration_id belonging to a different workspace", async () => {
    const inspirationId = await seedInspirationItem(OTHER_WORKSPACE);
    const result = await createIdeaItemAction(baseInput({ source_inspiration_id: inspirationId }));
    expect(result.success).toBe(false);
  });

  it("rejects a source_inspiration_id that does not exist at all", async () => {
    const result = await createIdeaItemAction(baseInput({ source_inspiration_id: "does_not_exist" }));
    expect(result.success).toBe(false);
  });

  it("never copies the referenced Inspiration's own content onto the Idea", async () => {
    const inspirationId = await seedInspirationItem(CURRENT_WORKSPACE_ID);
    const result = await createIdeaItemAction(baseInput({ source_inspiration_id: inspirationId, title: "My own original title" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("My own original title");
    expect(result.data.hook).toBeNull();
  });

  it("revalidates ownership when source_inspiration_id changes on update", async () => {
    const created = await createIdeaItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");
    const otherInspirationId = await seedInspirationItem(OTHER_WORKSPACE);

    const updated = await updateIdeaItemAction(created.data.id, { source_inspiration_id: otherInspirationId });
    expect(updated.success).toBe(false);
  });

  it("SOCIAL-07F hardening — normalizes an empty-string source_inspiration_id to null on create, rather than persisting an unvalidated non-null reference", async () => {
    const result = await createIdeaItemAction(baseInput({ source_inspiration_id: "" as never }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_inspiration_id).toBeNull();
  });

  it("SOCIAL-07F hardening — normalizes an empty-string source_inspiration_id to null on update", async () => {
    const created = await createIdeaItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    const updated = await updateIdeaItemAction(created.data.id, { source_inspiration_id: "" as never });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.source_inspiration_id).toBeNull();
  });
});

describe("Idea actions — MediaAsset reference validation", () => {
  it("rejects a media_asset_id belonging to a different workspace", async () => {
    writeMediaAssets([mediaAsset({ id: "asset_other_ws", workspace_id: OTHER_WORKSPACE })]);
    const result = await createIdeaItemAction(baseInput({ media_asset_id: "asset_other_ws" }));
    expect(result.success).toBe(false);
  });

  it("rejects a media_asset_id that does not exist at all", async () => {
    const result = await createIdeaItemAction(baseInput({ media_asset_id: "does_not_exist" }));
    expect(result.success).toBe(false);
  });

  it("accepts a same-workspace media asset regardless of approval status — no approval gate for Ideas", async () => {
    for (const status of ["pending", "approved", "rejected", "needs_revision"] as const) {
      writeMediaAssets([mediaAsset({ id: `asset_${status}`, workspace_id: CURRENT_WORKSPACE_ID, status })]);
      const result = await createIdeaItemAction(baseInput({ media_asset_id: `asset_${status}`, title: `Idea for ${status}` }));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.media_asset_id).toBe(`asset_${status}`);
    }
  });

  it("never mutates the MediaAsset itself — status/approval fields are untouched by attaching it", async () => {
    writeMediaAssets([mediaAsset({ id: "asset_pending", workspace_id: CURRENT_WORKSPACE_ID, status: "pending" })]);
    await createIdeaItemAction(baseInput({ media_asset_id: "asset_pending" }));

    const [asset] = (await import("@/lib/data/mock/mediaAssetsStore")).readMediaAssets();
    expect(asset.status).toBe("pending");
    expect(asset.approved_by).toBeNull();
    expect(asset.approved_at).toBeNull();
  });

  it("attaches a MediaAsset on create, replaces it on update, and removes it back to null", async () => {
    writeMediaAssets([
      mediaAsset({ id: "asset_a", workspace_id: CURRENT_WORKSPACE_ID }),
      mediaAsset({ id: "asset_b", workspace_id: CURRENT_WORKSPACE_ID }),
    ]);

    const created = await createIdeaItemAction(baseInput({ media_asset_id: "asset_a" }));
    if (!created.success) throw new Error("setup failed");
    expect(created.data.media_asset_id).toBe("asset_a");

    const replaced = await updateIdeaItemAction(created.data.id, { media_asset_id: "asset_b" });
    expect(replaced.success).toBe(true);
    if (replaced.success) expect(replaced.data.media_asset_id).toBe("asset_b");

    const removed = await updateIdeaItemAction(created.data.id, { media_asset_id: null });
    expect(removed.success).toBe(true);
    if (removed.success) expect(removed.data.media_asset_id).toBeNull();
  });

  it("revalidates ownership when media_asset_id changes on update", async () => {
    const created = await createIdeaItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");
    writeMediaAssets([mediaAsset({ id: "asset_other_ws", workspace_id: OTHER_WORKSPACE })]);

    const updated = await updateIdeaItemAction(created.data.id, { media_asset_id: "asset_other_ws" });
    expect(updated.success).toBe(false);
  });

  it("SOCIAL-07F hardening — normalizes an empty-string media_asset_id to null on create, rather than persisting an unvalidated non-null reference", async () => {
    const result = await createIdeaItemAction(baseInput({ media_asset_id: "" as never }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.media_asset_id).toBeNull();
  });

  it("SOCIAL-07F hardening — normalizes an empty-string media_asset_id to null on update", async () => {
    const created = await createIdeaItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    const updated = await updateIdeaItemAction(created.data.id, { media_asset_id: "" as never });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.media_asset_id).toBeNull();
  });
});

describe("Idea actions — cross-workspace isolation", () => {
  it("updateIdeaItemAction rejects an item owned by a different workspace", async () => {
    const created = await createIdeaItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await updateIdeaItemAction(created.data.id, { title: "Hijacked" });
    expect(result.success).toBe(false);
  });

  it("archiveIdeaItemAction rejects an item owned by a different workspace", async () => {
    const created = await createIdeaItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await archiveIdeaItemAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("unarchiveIdeaItemAction rejects an item owned by a different workspace", async () => {
    const created = await createIdeaItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await unarchiveIdeaItemAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("getIdeaItemAction never leaks a different workspace's item", async () => {
    const created = await createIdeaItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await getIdeaItemAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("listIdeaItemsAction never returns another workspace's items", async () => {
    await createIdeaItemAction(baseInput({ title: "Mine" }));

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await listIdeaItemsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });
});

describe("Idea actions — update / archive / unarchive lifecycle", () => {
  it("updates only the provided fields", async () => {
    const created = await createIdeaItemAction(baseInput({ title: "Original", notes: "Keep me" }));
    if (!created.success) throw new Error("setup failed");

    const updated = await updateIdeaItemAction(created.data.id, { title: "Updated" });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.title).toBe("Updated");
    expect(updated.data.notes).toBe("Keep me");
  });

  it("returns not-found when updating an id that does not exist", async () => {
    const result = await updateIdeaItemAction("nope", { title: "X" });
    expect(result.success).toBe(false);
  });

  it("archives then unarchives an item — never deletes it, reversible", async () => {
    const created = await createIdeaItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    const archived = await archiveIdeaItemAction(created.data.id);
    expect(archived.success).toBe(true);
    if (archived.success) {
      expect(archived.data.status).toBe("archived");
      expect(archived.data.archived_at).not.toBeNull();
    }

    const unarchived = await unarchiveIdeaItemAction(created.data.id);
    expect(unarchived.success).toBe(true);
    if (unarchived.success) {
      expect(unarchived.data.status).toBe("active");
      expect(unarchived.data.archived_at).toBeNull();
    }

    const stillThere = await getIdeaItemAction(created.data.id);
    expect(stillThere.success).toBe(true);
  });

  it("listIdeaItemsAction excludes archived items by default", async () => {
    const created = await createIdeaItemAction(baseInput({ title: "Will archive" }));
    if (!created.success) throw new Error("setup failed");
    await archiveIdeaItemAction(created.data.id);

    const result = await listIdeaItemsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });

  it("rejects an update against an archived item — restore it first", async () => {
    const created = await createIdeaItemAction(baseInput({ title: "Will archive" }));
    if (!created.success) throw new Error("setup failed");
    await archiveIdeaItemAction(created.data.id);

    const result = await updateIdeaItemAction(created.data.id, { title: "Should not apply" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/restore it first/i);

    const stillArchived = await getIdeaItemAction(created.data.id);
    expect(stillArchived.success).toBe(true);
    if (stillArchived.success) expect(stillArchived.data.title).toBe("Will archive");
  });

  it("allows a normal edit again once the item is restored", async () => {
    const created = await createIdeaItemAction(baseInput({ title: "Will archive" }));
    if (!created.success) throw new Error("setup failed");
    await archiveIdeaItemAction(created.data.id);
    await unarchiveIdeaItemAction(created.data.id);

    const result = await updateIdeaItemAction(created.data.id, { title: "Updated after restore" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Updated after restore");
  });
});

describe("listIdeaMediaAssetOptionsAction", () => {
  it("requires social.create", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await listIdeaMediaAssetOptionsAction();
    expect(result.success).toBe(false);
  });

  it("returns the caller's own workspace assets regardless of status — no approval gate", async () => {
    writeMediaAssets([
      mediaAsset({ id: "asset_pending", status: "pending" }),
      mediaAsset({ id: "asset_approved", status: "approved" }),
      mediaAsset({ id: "asset_rejected", status: "rejected" }),
      mediaAsset({ id: "asset_needs_revision", status: "needs_revision" }),
    ]);

    const result = await listIdeaMediaAssetOptionsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((a) => a.id).sort()).toEqual(["asset_approved", "asset_needs_revision", "asset_pending", "asset_rejected"]);
  });

  it("never returns another workspace's assets", async () => {
    writeMediaAssets([mediaAsset({ id: "asset_mine" }), mediaAsset({ id: "asset_theirs", workspace_id: OTHER_WORKSPACE })]);

    const result = await listIdeaMediaAssetOptionsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((a) => a.id)).toEqual(["asset_mine"]);
  });
});
