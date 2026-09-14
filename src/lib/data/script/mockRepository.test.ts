import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockScriptRepository } from "@/lib/data/script/mockRepository";
import { readScriptItems, writeScriptItems, resetScriptItemsStore } from "@/lib/data/mock/scriptItemsStore";
import { resetScriptVersionsStore } from "@/lib/data/mock/scriptVersionsStore";
import { resetScriptBlocksStore } from "@/lib/data/mock/scriptBlocksStore";
import type { CreateScriptItemInput, CreateScriptVersionInput, CreateScriptBlockInput } from "@/lib/data/script/repository";

const WORKSPACE = "ws_1";
const OTHER_WORKSPACE = "ws_2";

function createItemInput(overrides: Partial<CreateScriptItemInput> = {}): CreateScriptItemInput {
  return {
    workspaceId: WORKSPACE,
    createdBy: "user_1",
    title: "Spring wedding behind-the-scenes",
    sourceIdeaId: null,
    ...overrides,
  };
}

beforeEach(() => {
  resetScriptItemsStore();
  resetScriptVersionsStore();
  resetScriptBlocksStore();
});

afterEach(() => {
  resetScriptItemsStore();
  resetScriptVersionsStore();
  resetScriptBlocksStore();
});

describe("mockScriptRepository.createScriptItem", () => {
  it("creates a script with status active and archived_at null", async () => {
    const result = await mockScriptRepository.createScriptItem(createItemInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("active");
    expect(result.data.archived_at).toBeNull();
  });

  it("stores created_by as the caller-supplied actor id verbatim", async () => {
    const result = await mockScriptRepository.createScriptItem(createItemInput({ createdBy: "11111111-1111-4111-8111-111111111111" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.created_by).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("preserves null source_idea_id when unset", async () => {
    const result = await mockScriptRepository.createScriptItem(createItemInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_idea_id).toBeNull();
  });

  it("persists a valid source_idea_id", async () => {
    const result = await mockScriptRepository.createScriptItem(createItemInput({ sourceIdeaId: "idea_1" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_idea_id).toBe("idea_1");
  });

  it("does not impose any title uniqueness — two Scripts may share a title in the same workspace", async () => {
    const first = await mockScriptRepository.createScriptItem(createItemInput({ title: "Same title" }));
    const second = await mockScriptRepository.createScriptItem(createItemInput({ title: "Same title" }));
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
  });
});

describe("mockScriptRepository.getScriptItemById", () => {
  it("returns the created item", async () => {
    const created = await mockScriptRepository.createScriptItem(createItemInput());
    if (!created.success) throw new Error("setup failed");
    const fetched = await mockScriptRepository.getScriptItemById(created.data.id);
    expect(fetched.id).toBe(created.data.id);
  });

  it("throws for an id that does not exist", async () => {
    await expect(mockScriptRepository.getScriptItemById("nope")).rejects.toThrow();
  });
});

describe("mockScriptRepository.listScriptItems", () => {
  it("defaults to active items only, excluding archived ones", async () => {
    const active = await mockScriptRepository.createScriptItem(createItemInput({ title: "Active" }));
    const toArchive = await mockScriptRepository.createScriptItem(createItemInput({ title: "Archived" }));
    if (!active.success || !toArchive.success) throw new Error("setup failed");
    await mockScriptRepository.archiveScriptItem(toArchive.data.id);

    const list = await mockScriptRepository.listScriptItems(WORKSPACE);
    expect(list.map((i) => i.title)).toEqual(["Active"]);
  });

  it("archived: 'archived' returns only archived items", async () => {
    const active = await mockScriptRepository.createScriptItem(createItemInput({ title: "Active" }));
    const toArchive = await mockScriptRepository.createScriptItem(createItemInput({ title: "Archived" }));
    if (!active.success || !toArchive.success) throw new Error("setup failed");
    await mockScriptRepository.archiveScriptItem(toArchive.data.id);

    const list = await mockScriptRepository.listScriptItems(WORKSPACE, { archived: "archived" });
    expect(list.map((i) => i.title)).toEqual(["Archived"]);
  });

  it("archived: 'all' returns both", async () => {
    const active = await mockScriptRepository.createScriptItem(createItemInput({ title: "Active" }));
    const toArchive = await mockScriptRepository.createScriptItem(createItemInput({ title: "Archived" }));
    if (!active.success || !toArchive.success) throw new Error("setup failed");
    await mockScriptRepository.archiveScriptItem(toArchive.data.id);

    const list = await mockScriptRepository.listScriptItems(WORKSPACE, { archived: "all" });
    expect(list).toHaveLength(2);
  });

  it("search matches a plain, case-insensitive substring of the title", async () => {
    await mockScriptRepository.createScriptItem(createItemInput({ title: "Behind the Scenes at a Wedding" }));
    await mockScriptRepository.createScriptItem(createItemInput({ title: "Studio Tour" }));

    const list = await mockScriptRepository.listScriptItems(WORKSPACE, { search: "wedding" });
    expect(list.map((i) => i.title)).toEqual(["Behind the Scenes at a Wedding"]);
  });

  it("excludes another workspace's items entirely", async () => {
    await mockScriptRepository.createScriptItem(createItemInput({ title: "Mine" }));
    await mockScriptRepository.createScriptItem(createItemInput({ workspaceId: OTHER_WORKSPACE, title: "Theirs" }));

    const list = await mockScriptRepository.listScriptItems(WORKSPACE);
    expect(list.map((i) => i.title)).toEqual(["Mine"]);
  });

  it("orders by created_at descending", async () => {
    const first = await mockScriptRepository.createScriptItem(createItemInput({ title: "First" }));
    const second = await mockScriptRepository.createScriptItem(createItemInput({ title: "Second" }));
    if (!first.success || !second.success) throw new Error("setup failed");

    writeScriptItems(
      readScriptItems().map((item) => {
        if (item.id === first.data.id) return { ...item, created_at: "2026-01-01T00:00:00.000Z" };
        if (item.id === second.data.id) return { ...item, created_at: "2026-01-02T00:00:00.000Z" };
        return item;
      }),
    );

    const list = await mockScriptRepository.listScriptItems(WORKSPACE);
    expect(list.map((i) => i.title)).toEqual(["Second", "First"]);
  });

  it("respects a bounded limit", async () => {
    await mockScriptRepository.createScriptItem(createItemInput({ title: "A" }));
    await mockScriptRepository.createScriptItem(createItemInput({ title: "B" }));
    await mockScriptRepository.createScriptItem(createItemInput({ title: "C" }));

    const list = await mockScriptRepository.listScriptItems(WORKSPACE, { limit: 2 });
    expect(list).toHaveLength(2);
  });
});

describe("mockScriptRepository.updateScriptItem", () => {
  it("updates only the provided fields, leaving the rest untouched", async () => {
    const created = await mockScriptRepository.createScriptItem(createItemInput({ title: "Original" }));
    if (!created.success) throw new Error("setup failed");

    const updated = await mockScriptRepository.updateScriptItem(created.data.id, { title: "Updated" });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.title).toBe("Updated");
  });

  it("returns not-found for an id that does not exist", async () => {
    const result = await mockScriptRepository.updateScriptItem("nope", { title: "X" });
    expect(result.success).toBe(false);
  });

  it("allows clearing source_idea_id back to null", async () => {
    const created = await mockScriptRepository.createScriptItem(createItemInput({ sourceIdeaId: "idea_1" }));
    if (!created.success) throw new Error("setup failed");

    const updated = await mockScriptRepository.updateScriptItem(created.data.id, { sourceIdeaId: null });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.source_idea_id).toBeNull();
  });
});

describe("mockScriptRepository — archive / unarchive", () => {
  it("archives an item, setting status archived and archived_at", async () => {
    const created = await mockScriptRepository.createScriptItem(createItemInput());
    if (!created.success) throw new Error("setup failed");

    const archived = await mockScriptRepository.archiveScriptItem(created.data.id);
    expect(archived.success).toBe(true);
    if (!archived.success) return;
    expect(archived.data.status).toBe("archived");
    expect(archived.data.archived_at).not.toBeNull();
  });

  it("archiving an already-archived item is idempotent", async () => {
    const created = await mockScriptRepository.createScriptItem(createItemInput());
    if (!created.success) throw new Error("setup failed");
    await mockScriptRepository.archiveScriptItem(created.data.id);
    const secondArchive = await mockScriptRepository.archiveScriptItem(created.data.id);
    expect(secondArchive.success).toBe(true);
  });

  it("unarchives an item, restoring status active and clearing archived_at", async () => {
    const created = await mockScriptRepository.createScriptItem(createItemInput());
    if (!created.success) throw new Error("setup failed");
    await mockScriptRepository.archiveScriptItem(created.data.id);

    const unarchived = await mockScriptRepository.unarchiveScriptItem(created.data.id);
    expect(unarchived.success).toBe(true);
    if (!unarchived.success) return;
    expect(unarchived.data.status).toBe("active");
    expect(unarchived.data.archived_at).toBeNull();
  });

  it("unarchiving an already-active item is idempotent", async () => {
    const created = await mockScriptRepository.createScriptItem(createItemInput());
    if (!created.success) throw new Error("setup failed");
    const result = await mockScriptRepository.unarchiveScriptItem(created.data.id);
    expect(result.success).toBe(true);
  });

  it("never deletes the row — archiving still leaves it retrievable by id", async () => {
    const created = await mockScriptRepository.createScriptItem(createItemInput());
    if (!created.success) throw new Error("setup failed");
    await mockScriptRepository.archiveScriptItem(created.data.id);
    const fetched = await mockScriptRepository.getScriptItemById(created.data.id);
    expect(fetched.id).toBe(created.data.id);
  });
});

function createVersionInput(scriptId: string, overrides: Partial<CreateScriptVersionInput> = {}): CreateScriptVersionInput {
  return { scriptId, workspaceId: WORKSPACE, createdBy: "user_1", ...overrides };
}

describe("mockScriptRepository.createScriptVersion", () => {
  it("creates a draft version with version_number/published_at/published_by all null", async () => {
    const script = await mockScriptRepository.createScriptItem(createItemInput());
    if (!script.success) throw new Error("setup failed");

    const result = await mockScriptRepository.createScriptVersion(createVersionInput(script.data.id));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("draft");
    expect(result.data.version_number).toBeNull();
    expect(result.data.published_at).toBeNull();
    expect(result.data.published_by).toBeNull();
  });

  it("rejects a second draft for the same Script — mirrors the DB's one-draft-per-script invariant", async () => {
    const script = await mockScriptRepository.createScriptItem(createItemInput());
    if (!script.success) throw new Error("setup failed");

    await mockScriptRepository.createScriptVersion(createVersionInput(script.data.id));
    const second = await mockScriptRepository.createScriptVersion(createVersionInput(script.data.id));
    expect(second.success).toBe(false);
  });

  it("allows a draft for a different Script even while another Script already has one", async () => {
    const scriptA = await mockScriptRepository.createScriptItem(createItemInput({ title: "A" }));
    const scriptB = await mockScriptRepository.createScriptItem(createItemInput({ title: "B" }));
    if (!scriptA.success || !scriptB.success) throw new Error("setup failed");

    await mockScriptRepository.createScriptVersion(createVersionInput(scriptA.data.id));
    const result = await mockScriptRepository.createScriptVersion(createVersionInput(scriptB.data.id));
    expect(result.success).toBe(true);
  });
});

describe("mockScriptRepository.getScriptVersionById / listScriptVersions", () => {
  it("returns the created version by id", async () => {
    const script = await mockScriptRepository.createScriptItem(createItemInput());
    if (!script.success) throw new Error("setup failed");
    const created = await mockScriptRepository.createScriptVersion(createVersionInput(script.data.id));
    if (!created.success) throw new Error("setup failed");

    const fetched = await mockScriptRepository.getScriptVersionById(created.data.id);
    expect(fetched.id).toBe(created.data.id);
  });

  it("throws for a version id that does not exist", async () => {
    await expect(mockScriptRepository.getScriptVersionById("nope")).rejects.toThrow();
  });

  it("lists only versions belonging to the given script", async () => {
    const scriptA = await mockScriptRepository.createScriptItem(createItemInput({ title: "A" }));
    const scriptB = await mockScriptRepository.createScriptItem(createItemInput({ title: "B" }));
    if (!scriptA.success || !scriptB.success) throw new Error("setup failed");
    const versionA = await mockScriptRepository.createScriptVersion(createVersionInput(scriptA.data.id));
    await mockScriptRepository.createScriptVersion(createVersionInput(scriptB.data.id));
    if (!versionA.success) throw new Error("setup failed");

    const list = await mockScriptRepository.listScriptVersions(scriptA.data.id);
    expect(list.map((v) => v.id)).toEqual([versionA.data.id]);
  });
});

function createBlockInput(scriptVersionId: string, overrides: Partial<CreateScriptBlockInput> = {}): CreateScriptBlockInput {
  return { scriptVersionId, workspaceId: WORKSPACE, content: "Open on a wide shot of the venue.", sortOrder: 0, ...overrides };
}

describe("mockScriptRepository.createScriptBlock / listScriptBlocks", () => {
  async function setupVersion() {
    const script = await mockScriptRepository.createScriptItem(createItemInput());
    if (!script.success) throw new Error("setup failed");
    const version = await mockScriptRepository.createScriptVersion(createVersionInput(script.data.id));
    if (!version.success) throw new Error("setup failed");
    return version.data.id;
  }

  it("creates a block with the provided content and sort_order", async () => {
    const versionId = await setupVersion();
    const result = await mockScriptRepository.createScriptBlock(createBlockInput(versionId, { content: "Scene one.", sortOrder: 2 }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.content).toBe("Scene one.");
    expect(result.data.sort_order).toBe(2);
  });

  it("accepts an empty-string content block — a valid in-progress state", async () => {
    const versionId = await setupVersion();
    const result = await mockScriptRepository.createScriptBlock(createBlockInput(versionId, { content: "" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.content).toBe("");
  });

  it("lists blocks ordered by sort_order ascending, not insertion order", async () => {
    const versionId = await setupVersion();
    await mockScriptRepository.createScriptBlock(createBlockInput(versionId, { content: "Third", sortOrder: 2 }));
    await mockScriptRepository.createScriptBlock(createBlockInput(versionId, { content: "First", sortOrder: 0 }));
    await mockScriptRepository.createScriptBlock(createBlockInput(versionId, { content: "Second", sortOrder: 1 }));

    const list = await mockScriptRepository.listScriptBlocks(versionId);
    expect(list.map((b) => b.content)).toEqual(["First", "Second", "Third"]);
  });

  it("lists only blocks belonging to the given version", async () => {
    const versionAId = await setupVersion();
    const versionBId = await setupVersion();
    await mockScriptRepository.createScriptBlock(createBlockInput(versionAId, { content: "A" }));
    await mockScriptRepository.createScriptBlock(createBlockInput(versionBId, { content: "B" }));

    const list = await mockScriptRepository.listScriptBlocks(versionAId);
    expect(list.map((b) => b.content)).toEqual(["A"]);
  });
});

describe("mockScriptRepository.updateScriptBlock", () => {
  it("updates content and sort_order independently", async () => {
    const script = await mockScriptRepository.createScriptItem(createItemInput());
    if (!script.success) throw new Error("setup failed");
    const version = await mockScriptRepository.createScriptVersion(createVersionInput(script.data.id));
    if (!version.success) throw new Error("setup failed");
    const block = await mockScriptRepository.createScriptBlock(createBlockInput(version.data.id));
    if (!block.success) throw new Error("setup failed");

    const updatedContent = await mockScriptRepository.updateScriptBlock(block.data.id, { content: "Revised line." });
    expect(updatedContent.success).toBe(true);
    if (updatedContent.success) {
      expect(updatedContent.data.content).toBe("Revised line.");
      expect(updatedContent.data.sort_order).toBe(0);
    }

    const updatedOrder = await mockScriptRepository.updateScriptBlock(block.data.id, { sortOrder: 5 });
    expect(updatedOrder.success).toBe(true);
    if (updatedOrder.success) expect(updatedOrder.data.sort_order).toBe(5);
  });

  it("returns not-found for a block id that does not exist", async () => {
    const result = await mockScriptRepository.updateScriptBlock("nope", { content: "X" });
    expect(result.success).toBe(false);
  });

  it("allows setting sort_order to 0 explicitly, not treating it as unset", async () => {
    const script = await mockScriptRepository.createScriptItem(createItemInput());
    if (!script.success) throw new Error("setup failed");
    const version = await mockScriptRepository.createScriptVersion(createVersionInput(script.data.id));
    if (!version.success) throw new Error("setup failed");
    const block = await mockScriptRepository.createScriptBlock(createBlockInput(version.data.id, { sortOrder: 3 }));
    if (!block.success) throw new Error("setup failed");

    const updated = await mockScriptRepository.updateScriptBlock(block.data.id, { sortOrder: 0 });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.sort_order).toBe(0);
  });
});

describe("mockScriptRepository.removeScriptBlock", () => {
  it("removes the block — it no longer appears in the version's list", async () => {
    const script = await mockScriptRepository.createScriptItem(createItemInput());
    if (!script.success) throw new Error("setup failed");
    const version = await mockScriptRepository.createScriptVersion(createVersionInput(script.data.id));
    if (!version.success) throw new Error("setup failed");
    const block = await mockScriptRepository.createScriptBlock(createBlockInput(version.data.id));
    if (!block.success) throw new Error("setup failed");

    const result = await mockScriptRepository.removeScriptBlock(block.data.id);
    expect(result.success).toBe(true);

    const list = await mockScriptRepository.listScriptBlocks(version.data.id);
    expect(list).toHaveLength(0);
  });

  it("returns not-found for a block id that does not exist", async () => {
    const result = await mockScriptRepository.removeScriptBlock("nope");
    expect(result.success).toBe(false);
  });

  it("removes only the targeted block, leaving sibling blocks in the same version untouched", async () => {
    const script = await mockScriptRepository.createScriptItem(createItemInput());
    if (!script.success) throw new Error("setup failed");
    const version = await mockScriptRepository.createScriptVersion(createVersionInput(script.data.id));
    if (!version.success) throw new Error("setup failed");
    const blockA = await mockScriptRepository.createScriptBlock(createBlockInput(version.data.id, { content: "A", sortOrder: 0 }));
    const blockB = await mockScriptRepository.createScriptBlock(createBlockInput(version.data.id, { content: "B", sortOrder: 1 }));
    if (!blockA.success || !blockB.success) throw new Error("setup failed");

    await mockScriptRepository.removeScriptBlock(blockA.data.id);

    const list = await mockScriptRepository.listScriptBlocks(version.data.id);
    expect(list.map((b) => b.content)).toEqual(["B"]);
  });
});
