import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createCarouselItemAction,
  updateCarouselItemAction,
  getCarouselItemAction,
  listCarouselItemsAction,
  archiveCarouselItemAction,
  unarchiveCarouselItemAction,
  createCarouselSlideAction,
  listCarouselSlidesAction,
  updateCarouselSlideAction,
  removeCarouselSlideAction,
  listCarouselMediaAssetOptionsAction,
  type CarouselItemActionInput,
} from "@/modules/carousel/carouselActions";
import { resetCarouselItemsStore } from "@/lib/data/mock/carouselItemsStore";
import { resetCarouselSlidesStore } from "@/lib/data/mock/carouselSlidesStore";
import { resetIdeaItemsStore } from "@/lib/data/mock/ideaItemsStore";
import { writeMediaAssets, resetMediaAssetsStore } from "@/lib/data/mock/mediaAssetsStore";
import { createIdeaItem } from "@/lib/data";
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

function baseInput(overrides: Partial<CarouselItemActionInput> = {}): CarouselItemActionInput {
  return { title: "Autumn wedding carousel", source_idea_id: null, ...overrides };
}

async function seedIdeaItem(workspaceId: string): Promise<string> {
  const created = await createIdeaItem({
    workspaceId,
    createdBy: ACTOR_ID,
    title: "A great content idea",
    description: "A concept for future content.",
    sourceInspirationId: null,
    contentFormat: null,
    hook: null,
    cta: null,
    audience: null,
    notes: null,
    mediaAssetId: null,
    priority: null,
  });
  if (!created.success) throw new Error("Idea seed failed");
  return created.data.id;
}

async function seedCarouselItem(overrides: Partial<CarouselItemActionInput> = {}): Promise<string> {
  const created = await createCarouselItemAction(baseInput(overrides));
  if (!created.success) throw new Error("Carousel seed failed");
  return created.data.id;
}

beforeEach(() => {
  resetCarouselItemsStore();
  resetCarouselSlidesStore();
  resetIdeaItemsStore();
  resetMediaAssetsStore();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Carousel actions — authentication and permission (1, 2, 3)", () => {
  it("an authenticated workspace member can read their own Carousel (social.view)", async () => {
    const carouselId = await seedCarouselItem();
    const result = await getCarouselItemAction(carouselId);
    expect(result.success).toBe(true);
  });

  it("an authenticated workspace member with social.create can write their own Carousel", async () => {
    const result = await createCarouselItemAction(baseInput());
    expect(result.success).toBe(true);
  });

  it("rejects an unauthenticated caller (non-member)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await createCarouselItemAction(baseInput());
    expect(result.success).toBe(false);
  });

  it("rejects a caller with only social.view attempting a write", async () => {
    const carouselId = await seedCarouselItem();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await updateCarouselItemAction(carouselId, { title: "Renamed" });
    expect(result.success).toBe(false);
  });

  it("rejects a caller with no permissions at all", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionSession);
    const result = await createCarouselItemAction(baseInput());
    expect(result.success).toBe(false);
  });
});

describe("Carousel actions — cross-workspace rejection (4, 5)", () => {
  it("a Carousel from another workspace cannot be read", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const carouselId = await seedCarouselItem();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);

    const result = await getCarouselItemAction(carouselId);
    expect(result.success).toBe(false);
  });

  it("a Carousel from another workspace cannot be mutated", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const carouselId = await seedCarouselItem();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);

    const result = await updateCarouselItemAction(carouselId, { title: "Hijacked" });
    expect(result.success).toBe(false);
  });

  it("a Carousel from another workspace cannot be archived", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const carouselId = await seedCarouselItem();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);

    const result = await archiveCarouselItemAction(carouselId);
    expect(result.success).toBe(false);
  });

  it("never lists another workspace's Carousels", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    await seedCarouselItem();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);

    const result = await listCarouselItemsAction({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });
});

describe("Carousel actions — source Idea ownership (6)", () => {
  it("accepts a real Idea owned by the caller's own workspace", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const result = await createCarouselItemAction(baseInput({ source_idea_id: ideaId }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.source_idea_id).toBe(ideaId);
  });

  it("rejects a source Idea belonging to another workspace", async () => {
    const ideaId = await seedIdeaItem(OTHER_WORKSPACE);
    const result = await createCarouselItemAction(baseInput({ source_idea_id: ideaId }));
    expect(result.success).toBe(false);
  });

  it("rejects a source Idea that does not exist", async () => {
    const result = await createCarouselItemAction(baseInput({ source_idea_id: "does-not-exist" }));
    expect(result.success).toBe(false);
  });

  it("never mutates the referenced Idea — provenance only, never copied or synced", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const before = await (await import("@/lib/data")).getIdeaItemById(ideaId);
    await seedCarouselItem({ source_idea_id: ideaId });
    const after = await (await import("@/lib/data")).getIdeaItemById(ideaId);
    expect(after).toEqual(before);
  });

  it("an empty-string source_idea_id normalizes to null rather than bypassing validation", async () => {
    const result = await createCarouselItemAction(baseInput({ source_idea_id: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.source_idea_id).toBeNull();
  });
});

describe("Carousel actions — MediaAsset ownership (7)", () => {
  it("accepts a real MediaAsset owned by the caller's own workspace", async () => {
    writeMediaAssets([mediaAsset({ id: "asset_mine", workspace_id: CURRENT_WORKSPACE_ID })]);
    const carouselId = await seedCarouselItem();
    const result = await createCarouselSlideAction(carouselId, { content: "Slide", sort_order: 0, media_asset_id: "asset_mine" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.media_asset_id).toBe("asset_mine");
  });

  it("rejects a MediaAsset belonging to another workspace", async () => {
    writeMediaAssets([mediaAsset({ id: "asset_theirs", workspace_id: OTHER_WORKSPACE })]);
    const carouselId = await seedCarouselItem();
    const result = await createCarouselSlideAction(carouselId, { content: "Slide", sort_order: 0, media_asset_id: "asset_theirs" });
    expect(result.success).toBe(false);
  });

  it("rejects a MediaAsset that does not exist", async () => {
    const carouselId = await seedCarouselItem();
    const result = await createCarouselSlideAction(carouselId, { content: "Slide", sort_order: 0, media_asset_id: "does-not-exist" });
    expect(result.success).toBe(false);
  });

  it("a slide may exist with no MediaAsset at all", async () => {
    const carouselId = await seedCarouselItem();
    const result = await createCarouselSlideAction(carouselId, { content: "Slide", sort_order: 0, media_asset_id: null });
    expect(result.success).toBe(true);
  });

  it("also validates MediaAsset ownership on update, and never mutates the MediaAsset itself", async () => {
    writeMediaAssets([mediaAsset({ id: "asset_mine", workspace_id: CURRENT_WORKSPACE_ID, status: "pending" })]);
    const carouselId = await seedCarouselItem();
    const created = await createCarouselSlideAction(carouselId, { content: "Slide", sort_order: 0, media_asset_id: null });
    if (!created.success) throw new Error("setup failed");

    const updated = await updateCarouselSlideAction(carouselId, created.data.id, { media_asset_id: "asset_mine" });
    expect(updated.success).toBe(true);

    const rejected = await updateCarouselSlideAction(carouselId, created.data.id, { media_asset_id: "does-not-exist" });
    expect(rejected.success).toBe(false);

    const [asset] = (await import("@/lib/data/mock/mediaAssetsStore")).readMediaAssets();
    expect(asset.status).toBe("pending");
  });
});

describe("Carousel actions — slide cross-workspace and cross-carousel rejection (8, 9)", () => {
  it("rejects operating on a slide when the supplied carouselId belongs to another workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const carouselId = await seedCarouselItem();
    const slide = await createCarouselSlideAction(carouselId, { content: "Slide", sort_order: 0, media_asset_id: null });
    if (!slide.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const result = await updateCarouselSlideAction(carouselId, slide.data.id, { content: "Hijacked" });
    expect(result.success).toBe(false);
  });

  it("rejects a slide id that belongs to a different Carousel, even in the same workspace", async () => {
    const carouselA = await seedCarouselItem({ title: "Carousel A" });
    const carouselB = await seedCarouselItem({ title: "Carousel B" });
    const slideInA = await createCarouselSlideAction(carouselA, { content: "In A", sort_order: 0, media_asset_id: null });
    if (!slideInA.success) throw new Error("setup failed");

    const result = await updateCarouselSlideAction(carouselB, slideInA.data.id, { content: "Hijacked" });
    expect(result.success).toBe(false);
  });

  it("removeCarouselSlideAction rejects a slide id belonging to a different Carousel", async () => {
    const carouselA = await seedCarouselItem({ title: "Carousel A" });
    const carouselB = await seedCarouselItem({ title: "Carousel B" });
    const slideInA = await createCarouselSlideAction(carouselA, { content: "In A", sort_order: 0, media_asset_id: null });
    if (!slideInA.success) throw new Error("setup failed");

    const result = await removeCarouselSlideAction(carouselB, slideInA.data.id);
    expect(result.success).toBe(false);

    const stillThere = await listCarouselSlidesAction(carouselA);
    expect(stillThere.success && stillThere.data).toHaveLength(1);
  });
});

describe("Carousel actions — archived-parent blocks child mutation (10)", () => {
  it("rejects updating the Carousel's own fields while archived", async () => {
    const carouselId = await seedCarouselItem();
    await archiveCarouselItemAction(carouselId);
    const result = await updateCarouselItemAction(carouselId, { title: "Edited while archived" });
    expect(result.success).toBe(false);
  });

  it("rejects creating a slide on an archived Carousel", async () => {
    const carouselId = await seedCarouselItem();
    await archiveCarouselItemAction(carouselId);
    const result = await createCarouselSlideAction(carouselId, { content: "New slide", sort_order: 0, media_asset_id: null });
    expect(result.success).toBe(false);
  });

  it("rejects updating a slide on an archived Carousel", async () => {
    const carouselId = await seedCarouselItem();
    const slide = await createCarouselSlideAction(carouselId, { content: "Original", sort_order: 0, media_asset_id: null });
    if (!slide.success) throw new Error("setup failed");
    await archiveCarouselItemAction(carouselId);

    const result = await updateCarouselSlideAction(carouselId, slide.data.id, { content: "Edited while archived" });
    expect(result.success).toBe(false);
  });

  it("rejects removing a slide on an archived Carousel", async () => {
    const carouselId = await seedCarouselItem();
    const slide = await createCarouselSlideAction(carouselId, { content: "Original", sort_order: 0, media_asset_id: null });
    if (!slide.success) throw new Error("setup failed");
    await archiveCarouselItemAction(carouselId);

    const result = await removeCarouselSlideAction(carouselId, slide.data.id);
    expect(result.success).toBe(false);
  });

  it("reads remain available on an archived Carousel's slides", async () => {
    const carouselId = await seedCarouselItem();
    await createCarouselSlideAction(carouselId, { content: "Slide", sort_order: 0, media_asset_id: null });
    await archiveCarouselItemAction(carouselId);

    const result = await listCarouselSlidesAction(carouselId);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(1);
  });

  it("child mutations work again after unarchiving", async () => {
    const carouselId = await seedCarouselItem();
    await archiveCarouselItemAction(carouselId);
    await unarchiveCarouselItemAction(carouselId);

    const result = await createCarouselSlideAction(carouselId, { content: "Slide", sort_order: 0, media_asset_id: null });
    expect(result.success).toBe(true);
  });
});

describe("Carousel actions — no physical parent DELETE (11)", () => {
  it("exposes no deleteCarouselItemAction / removeCarouselItemAction of any kind", () => {
    const source = readFileSync(path.resolve(__dirname, "carouselActions.ts"), "utf-8");
    expect(source).not.toMatch(/export async function (delete|remove)CarouselItemAction/);
  });

  it("archiving a Carousel never removes it — it remains retrievable", async () => {
    const carouselId = await seedCarouselItem();
    await archiveCarouselItemAction(carouselId);
    const result = await getCarouselItemAction(carouselId);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("archived");
  });
});

describe("Carousel actions — slide removal (12)", () => {
  it("removes only the targeted, authorized slide", async () => {
    const carouselId = await seedCarouselItem();
    const keep = await createCarouselSlideAction(carouselId, { content: "Keep me", sort_order: 0, media_asset_id: null });
    const remove = await createCarouselSlideAction(carouselId, { content: "Remove me", sort_order: 1, media_asset_id: null });
    if (!keep.success || !remove.success) throw new Error("setup failed");

    const result = await removeCarouselSlideAction(carouselId, remove.data.id);
    expect(result.success).toBe(true);

    const list = await listCarouselSlidesAction(carouselId);
    expect(list.success && list.data).toHaveLength(1);
    expect(list.success && list.data[0].content).toBe("Keep me");
  });

  it("removeCarouselSlideAction fails for a slide that does not exist", async () => {
    const carouselId = await seedCarouselItem();
    const result = await removeCarouselSlideAction(carouselId, "does-not-exist");
    expect(result.success).toBe(false);
  });
});

describe("Carousel actions — permission model (13, 14)", () => {
  it("never uses social.publish as a permission literal", () => {
    const source = readFileSync(path.resolve(__dirname, "carouselActions.ts"), "utf-8");
    expect(source).not.toContain('"social.publish"');
  });

  it("requireActiveSession only ever accepts social.view or social.create — no new permission introduced", () => {
    const source = readFileSync(path.resolve(__dirname, "carouselActions.ts"), "utf-8");
    expect(source).toContain('permission: "social.view" | "social.create"');
    expect(source).not.toMatch(/"carousel\./);
  });

  it("never imports an AI provider/runtime, never makes a network call", () => {
    const source = readFileSync(path.resolve(__dirname, "carouselActions.ts"), "utf-8");
    expect(source).not.toMatch(/from "@\/core\/ai\//);
    expect(source).not.toMatch(/\bfetch\(/);
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toContain("eval(");
  });
});

describe("Carousel actions — ordering, validation, and list behavior", () => {
  it("lists slides ordered by sort_order ascending", async () => {
    const carouselId = await seedCarouselItem();
    await createCarouselSlideAction(carouselId, { content: "Second", sort_order: 1, media_asset_id: null });
    await createCarouselSlideAction(carouselId, { content: "First", sort_order: 0, media_asset_id: null });

    const result = await listCarouselSlidesAction(carouselId);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.map((s) => s.content)).toEqual(["First", "Second"]);
  });

  it("rejects an empty title on create", async () => {
    const result = await createCarouselItemAction(baseInput({ title: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a negative sort_order", async () => {
    const carouselId = await seedCarouselItem();
    const result = await createCarouselSlideAction(carouselId, { content: "Slide", sort_order: -1, media_asset_id: null });
    expect(result.success).toBe(false);
  });

  it("handles sort_order 0 correctly on update (?? not ||)", async () => {
    const carouselId = await seedCarouselItem();
    const created = await createCarouselSlideAction(carouselId, { content: "Slide", sort_order: 5, media_asset_id: null });
    if (!created.success) throw new Error("setup failed");
    const updated = await updateCarouselSlideAction(carouselId, created.data.id, { sort_order: 0 });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.sort_order).toBe(0);
  });

  it("clamps an out-of-range list limit rather than allowing an unbounded read", async () => {
    const result = await listCarouselItemsAction({ limit: 99999 });
    expect(result.success).toBe(true);
  });

  it("getCarouselItemAction returns a controlled not-found error for a nonexistent id", async () => {
    const result = await getCarouselItemAction("does-not-exist");
    expect(result.success).toBe(false);
  });
});

describe("SOCIAL-10F — listCarouselMediaAssetOptionsAction permission gate", () => {
  it("requires social.create — a social.view-only caller is rejected, matching listIdeaMediaAssetOptionsAction's own precedent exactly", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await listCarouselMediaAssetOptionsAction();
    expect(result.success).toBe(false);
  });

  it("returns the caller's own workspace assets regardless of status — no approval gate", async () => {
    writeMediaAssets([
      mediaAsset({ id: "asset_pending", status: "pending" }),
      mediaAsset({ id: "asset_approved", status: "approved" }),
      mediaAsset({ id: "asset_rejected", status: "rejected" }),
      mediaAsset({ id: "asset_needs_revision", status: "needs_revision" }),
    ]);

    const result = await listCarouselMediaAssetOptionsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((a) => a.id).sort()).toEqual(["asset_approved", "asset_needs_revision", "asset_pending", "asset_rejected"]);
  });

  it("never returns another workspace's assets", async () => {
    writeMediaAssets([mediaAsset({ id: "asset_mine" }), mediaAsset({ id: "asset_theirs", workspace_id: OTHER_WORKSPACE })]);

    const result = await listCarouselMediaAssetOptionsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((a) => a.id)).toEqual(["asset_mine"]);
  });
});
