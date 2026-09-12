import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockInspirationItemsRepository } from "@/lib/data/inspiration/mockRepository";
import { readInspirationItems, writeInspirationItems, resetInspirationItemsStore } from "@/lib/data/mock/inspirationItemsStore";
import type { CreateInspirationItemInput } from "@/lib/data/inspiration/repository";

const WORKSPACE = "ws_1";
const OTHER_WORKSPACE = "ws_2";

function createInput(overrides: Partial<CreateInspirationItemInput> = {}): CreateInspirationItemInput {
  return {
    workspaceId: WORKSPACE,
    createdBy: "user_1",
    title: "A great Reel idea",
    sourceType: "instagram",
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
    ...overrides,
  };
}

beforeEach(() => {
  resetInspirationItemsStore();
});

afterEach(() => {
  resetInspirationItemsStore();
});

describe("mockInspirationItemsRepository.createInspirationItem", () => {
  it("creates a manual item without a URL", async () => {
    const result = await mockInspirationItemsRepository.createInspirationItem(createInput({ sourceType: "manual" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_url).toBeNull();
    expect(result.data.normalized_source_url).toBeNull();
    expect(result.data.archived_at).toBeNull();
  });

  it("persists the normalized URL alongside the original source_url", async () => {
    const result = await mockInspirationItemsRepository.createInspirationItem(
      createInput({ sourceUrl: "https://Instagram.com/reel/ABC123/?utm_source=ig", normalizedSourceUrl: "https://instagram.com/reel/ABC123" }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_url).toBe("https://Instagram.com/reel/ABC123/?utm_source=ig");
    expect(result.data.normalized_source_url).toBe("https://instagram.com/reel/ABC123");
  });

  it("stores created_by as the caller-supplied actor id verbatim (a UUID in real use, never a display name)", async () => {
    const result = await mockInspirationItemsRepository.createInspirationItem(createInput({ createdBy: "11111111-1111-4111-8111-111111111111" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.created_by).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("preserves null for every optional field left unset, and a real zero duration distinctly", async () => {
    const result = await mockInspirationItemsRepository.createInspirationItem(createInput({ durationSeconds: 0 }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.duration_seconds).toBe(0);
    expect(result.data.creator_name).toBeNull();
    expect(result.data.creator_handle).toBeNull();
    expect(result.data.platform_content_id).toBeNull();
    expect(result.data.content_format).toBeNull();
    expect(result.data.hook).toBeNull();
    expect(result.data.cta).toBeNull();
    expect(result.data.why_it_works).toBeNull();
    expect(result.data.notes).toBeNull();
    expect(result.data.published_at).toBeNull();
    expect(result.data.media_asset_id).toBeNull();
  });
});

describe("mockInspirationItemsRepository — duplicate detection", () => {
  it("rejects a second item with the same normalized_source_url in the same workspace", async () => {
    await mockInspirationItemsRepository.createInspirationItem(createInput({ normalizedSourceUrl: "https://instagram.com/reel/abc" }));
    const second = await mockInspirationItemsRepository.createInspirationItem(createInput({ normalizedSourceUrl: "https://instagram.com/reel/abc" }));
    expect(second.success).toBe(false);
  });

  it("rejects a second item with the same (source_type, platform_content_id) in the same workspace", async () => {
    await mockInspirationItemsRepository.createInspirationItem(createInput({ platformContentId: "reel_abc" }));
    const second = await mockInspirationItemsRepository.createInspirationItem(createInput({ platformContentId: "reel_abc" }));
    expect(second.success).toBe(false);
  });

  it("allows the same normalized_source_url in a different workspace", async () => {
    await mockInspirationItemsRepository.createInspirationItem(createInput({ normalizedSourceUrl: "https://instagram.com/reel/abc" }));
    const second = await mockInspirationItemsRepository.createInspirationItem(
      createInput({ workspaceId: OTHER_WORKSPACE, normalizedSourceUrl: "https://instagram.com/reel/abc" }),
    );
    expect(second.success).toBe(true);
  });

  it("allows the same platform_content_id in a different workspace", async () => {
    await mockInspirationItemsRepository.createInspirationItem(createInput({ platformContentId: "reel_abc" }));
    const second = await mockInspirationItemsRepository.createInspirationItem(createInput({ workspaceId: OTHER_WORKSPACE, platformContentId: "reel_abc" }));
    expect(second.success).toBe(true);
  });

  it("does not treat two manual (null URL, null platform_content_id) items as duplicates of each other", async () => {
    await mockInspirationItemsRepository.createInspirationItem(createInput({ sourceType: "manual" }));
    const second = await mockInspirationItemsRepository.createInspirationItem(createInput({ sourceType: "manual" }));
    expect(second.success).toBe(true);
  });
});

describe("mockInspirationItemsRepository.getInspirationItemById", () => {
  it("returns the created item", async () => {
    const created = await mockInspirationItemsRepository.createInspirationItem(createInput());
    expect(created.success).toBe(true);
    if (!created.success) return;
    const fetched = await mockInspirationItemsRepository.getInspirationItemById(created.data.id);
    expect(fetched.id).toBe(created.data.id);
  });

  it("throws for an id that does not exist", async () => {
    await expect(mockInspirationItemsRepository.getInspirationItemById("nope")).rejects.toThrow();
  });
});

describe("mockInspirationItemsRepository.listInspirationItems", () => {
  it("defaults to active items only, excluding archived ones", async () => {
    const active = await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "Active" }));
    const toArchive = await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "Archived" }));
    if (!active.success || !toArchive.success) throw new Error("setup failed");
    await mockInspirationItemsRepository.archiveInspirationItem(toArchive.data.id);

    const list = await mockInspirationItemsRepository.listInspirationItems(WORKSPACE);
    expect(list.map((i) => i.title)).toEqual(["Active"]);
  });

  it("archived: 'archived' returns only archived items", async () => {
    const active = await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "Active" }));
    const toArchive = await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "Archived" }));
    if (!active.success || !toArchive.success) throw new Error("setup failed");
    await mockInspirationItemsRepository.archiveInspirationItem(toArchive.data.id);

    const list = await mockInspirationItemsRepository.listInspirationItems(WORKSPACE, { archived: "archived" });
    expect(list.map((i) => i.title)).toEqual(["Archived"]);
  });

  it("archived: 'all' returns both", async () => {
    const active = await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "Active" }));
    const toArchive = await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "Archived" }));
    if (!active.success || !toArchive.success) throw new Error("setup failed");
    await mockInspirationItemsRepository.archiveInspirationItem(toArchive.data.id);

    const list = await mockInspirationItemsRepository.listInspirationItems(WORKSPACE, { archived: "all" });
    expect(list).toHaveLength(2);
  });

  it("filters by source_type", async () => {
    await mockInspirationItemsRepository.createInspirationItem(createInput({ sourceType: "instagram", title: "IG" }));
    await mockInspirationItemsRepository.createInspirationItem(createInput({ sourceType: "tiktok", title: "TikTok" }));

    const list = await mockInspirationItemsRepository.listInspirationItems(WORKSPACE, { sourceType: "tiktok" });
    expect(list.map((i) => i.title)).toEqual(["TikTok"]);
  });

  it("filters by content_format", async () => {
    await mockInspirationItemsRepository.createInspirationItem(createInput({ contentFormat: "reel", title: "Reel" }));
    await mockInspirationItemsRepository.createInspirationItem(createInput({ contentFormat: "carousel", title: "Carousel" }));

    const list = await mockInspirationItemsRepository.listInspirationItems(WORKSPACE, { contentFormat: "carousel" });
    expect(list.map((i) => i.title)).toEqual(["Carousel"]);
  });

  it("search matches a plain, case-insensitive substring of the title", async () => {
    await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "Behind the Scenes at a Wedding" }));
    await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "Studio Tour" }));

    const list = await mockInspirationItemsRepository.listInspirationItems(WORKSPACE, { search: "wedding" });
    expect(list.map((i) => i.title)).toEqual(["Behind the Scenes at a Wedding"]);
  });

  it("excludes another workspace's items entirely", async () => {
    await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "Mine" }));
    await mockInspirationItemsRepository.createInspirationItem(createInput({ workspaceId: OTHER_WORKSPACE, title: "Theirs" }));

    const list = await mockInspirationItemsRepository.listInspirationItems(WORKSPACE);
    expect(list.map((i) => i.title)).toEqual(["Mine"]);
  });

  it("orders by created_at descending", async () => {
    const first = await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "First" }));
    const second = await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "Second" }));
    if (!first.success || !second.success) throw new Error("setup failed");

    // Force a deterministic, unambiguous ordering directly in the store —
    // two real `createInspirationItem` calls in the same test tick can land
    // on the identical millisecond, which would make an assertion that
    // relies on wall-clock timing flaky.
    writeInspirationItems(
      readInspirationItems().map((item) => {
        if (item.id === first.data.id) return { ...item, created_at: "2026-01-01T00:00:00.000Z" };
        if (item.id === second.data.id) return { ...item, created_at: "2026-01-02T00:00:00.000Z" };
        return item;
      }),
    );

    const list = await mockInspirationItemsRepository.listInspirationItems(WORKSPACE);
    expect(list.map((i) => i.title)).toEqual(["Second", "First"]);
  });

  it("tie-breaks deterministically by id when created_at is identical", async () => {
    const a = await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "A" }));
    const b = await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "B" }));
    if (!a.success || !b.success) throw new Error("setup failed");

    const list = await mockInspirationItemsRepository.listInspirationItems(WORKSPACE);
    const expectedOrder = [a.data, b.data].sort((x, y) => y.id.localeCompare(x.id)).map((i) => i.title);
    expect(list.map((i) => i.title)).toEqual(expectedOrder);
  });

  it("respects a bounded limit", async () => {
    await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "A" }));
    await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "B" }));
    await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "C" }));

    const list = await mockInspirationItemsRepository.listInspirationItems(WORKSPACE, { limit: 2 });
    expect(list).toHaveLength(2);
  });
});

describe("mockInspirationItemsRepository.updateInspirationItem", () => {
  it("updates only the provided fields, leaving the rest untouched", async () => {
    const created = await mockInspirationItemsRepository.createInspirationItem(createInput({ title: "Original", notes: "Keep me" }));
    if (!created.success) throw new Error("setup failed");

    const updated = await mockInspirationItemsRepository.updateInspirationItem(created.data.id, { title: "Updated" });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.title).toBe("Updated");
    expect(updated.data.notes).toBe("Keep me");
  });

  it("renormalizes the URL when source_url changes", async () => {
    const created = await mockInspirationItemsRepository.createInspirationItem(createInput({ sourceUrl: null, normalizedSourceUrl: null }));
    if (!created.success) throw new Error("setup failed");

    const updated = await mockInspirationItemsRepository.updateInspirationItem(created.data.id, {
      sourceUrl: "https://TikTok.com/@user/video/123",
      normalizedSourceUrl: "https://tiktok.com/@user/video/123",
    });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.normalized_source_url).toBe("https://tiktok.com/@user/video/123");
  });

  it("rejects an update that would collide with another item's normalized_source_url in the same workspace", async () => {
    await mockInspirationItemsRepository.createInspirationItem(createInput({ normalizedSourceUrl: "https://instagram.com/reel/taken" }));
    const other = await mockInspirationItemsRepository.createInspirationItem(createInput({ normalizedSourceUrl: "https://instagram.com/reel/free" }));
    if (!other.success) throw new Error("setup failed");

    const result = await mockInspirationItemsRepository.updateInspirationItem(other.data.id, { normalizedSourceUrl: "https://instagram.com/reel/taken" });
    expect(result.success).toBe(false);
  });

  it("returns not-found for an id that does not exist", async () => {
    const result = await mockInspirationItemsRepository.updateInspirationItem("nope", { title: "X" });
    expect(result.success).toBe(false);
  });
});

describe("mockInspirationItemsRepository — archive / unarchive", () => {
  it("archives an item, setting archived_at", async () => {
    const created = await mockInspirationItemsRepository.createInspirationItem(createInput());
    if (!created.success) throw new Error("setup failed");

    const archived = await mockInspirationItemsRepository.archiveInspirationItem(created.data.id);
    expect(archived.success).toBe(true);
    if (!archived.success) return;
    expect(archived.data.archived_at).not.toBeNull();
  });

  it("archiving an already-archived item is idempotent", async () => {
    const created = await mockInspirationItemsRepository.createInspirationItem(createInput());
    if (!created.success) throw new Error("setup failed");
    await mockInspirationItemsRepository.archiveInspirationItem(created.data.id);
    const secondArchive = await mockInspirationItemsRepository.archiveInspirationItem(created.data.id);
    expect(secondArchive.success).toBe(true);
  });

  it("unarchives an item, clearing archived_at back to null", async () => {
    const created = await mockInspirationItemsRepository.createInspirationItem(createInput());
    if (!created.success) throw new Error("setup failed");
    await mockInspirationItemsRepository.archiveInspirationItem(created.data.id);

    const unarchived = await mockInspirationItemsRepository.unarchiveInspirationItem(created.data.id);
    expect(unarchived.success).toBe(true);
    if (!unarchived.success) return;
    expect(unarchived.data.archived_at).toBeNull();
  });

  it("unarchiving an already-active item is idempotent", async () => {
    const created = await mockInspirationItemsRepository.createInspirationItem(createInput());
    if (!created.success) throw new Error("setup failed");
    const result = await mockInspirationItemsRepository.unarchiveInspirationItem(created.data.id);
    expect(result.success).toBe(true);
  });

  it("never deletes the row — archiving still leaves it retrievable by id", async () => {
    const created = await mockInspirationItemsRepository.createInspirationItem(createInput());
    if (!created.success) throw new Error("setup failed");
    await mockInspirationItemsRepository.archiveInspirationItem(created.data.id);
    const fetched = await mockInspirationItemsRepository.getInspirationItemById(created.data.id);
    expect(fetched.id).toBe(created.data.id);
  });
});
