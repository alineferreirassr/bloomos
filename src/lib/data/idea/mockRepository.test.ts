import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockIdeaItemsRepository } from "@/lib/data/idea/mockRepository";
import { readIdeaItems, writeIdeaItems, resetIdeaItemsStore } from "@/lib/data/mock/ideaItemsStore";
import type { CreateIdeaItemInput } from "@/lib/data/idea/repository";

const WORKSPACE = "ws_1";
const OTHER_WORKSPACE = "ws_2";

function createInput(overrides: Partial<CreateIdeaItemInput> = {}): CreateIdeaItemInput {
  return {
    workspaceId: WORKSPACE,
    createdBy: "user_1",
    title: "Behind the scenes at a spring wedding",
    description: "A short reel following setup to first dance.",
    sourceInspirationId: null,
    contentFormat: null,
    hook: null,
    cta: null,
    audience: null,
    notes: null,
    mediaAssetId: null,
    priority: null,
    ...overrides,
  };
}

beforeEach(() => {
  resetIdeaItemsStore();
});

afterEach(() => {
  resetIdeaItemsStore();
});

describe("mockIdeaItemsRepository.createIdeaItem", () => {
  it("creates an idea with status active and archived_at null", async () => {
    const result = await mockIdeaItemsRepository.createIdeaItem(createInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("active");
    expect(result.data.archived_at).toBeNull();
  });

  it("stores created_by as the caller-supplied actor id verbatim", async () => {
    const result = await mockIdeaItemsRepository.createIdeaItem(createInput({ createdBy: "11111111-1111-4111-8111-111111111111" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.created_by).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("preserves null for every optional field left unset", async () => {
    const result = await mockIdeaItemsRepository.createIdeaItem(createInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_inspiration_id).toBeNull();
    expect(result.data.content_format).toBeNull();
    expect(result.data.hook).toBeNull();
    expect(result.data.cta).toBeNull();
    expect(result.data.audience).toBeNull();
    expect(result.data.notes).toBeNull();
    expect(result.data.media_asset_id).toBeNull();
    expect(result.data.priority).toBeNull();
  });

  it("does not impose any title uniqueness — two ideas may share a title in the same workspace", async () => {
    const first = await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "Same title" }));
    const second = await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "Same title" }));
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
  });

  it("persists a valid, same-workspace source_inspiration_id", async () => {
    const result = await mockIdeaItemsRepository.createIdeaItem(createInput({ sourceInspirationId: "insp_1" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_inspiration_id).toBe("insp_1");
  });

  it("persists a valid priority and content_format", async () => {
    const result = await mockIdeaItemsRepository.createIdeaItem(createInput({ priority: "high", contentFormat: "reel" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.priority).toBe("high");
    expect(result.data.content_format).toBe("reel");
  });
});

describe("mockIdeaItemsRepository.getIdeaItemById", () => {
  it("returns the created item", async () => {
    const created = await mockIdeaItemsRepository.createIdeaItem(createInput());
    expect(created.success).toBe(true);
    if (!created.success) return;
    const fetched = await mockIdeaItemsRepository.getIdeaItemById(created.data.id);
    expect(fetched.id).toBe(created.data.id);
  });

  it("throws for an id that does not exist", async () => {
    await expect(mockIdeaItemsRepository.getIdeaItemById("nope")).rejects.toThrow();
  });
});

describe("mockIdeaItemsRepository.listIdeaItems", () => {
  it("defaults to active items only, excluding archived ones", async () => {
    const active = await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "Active" }));
    const toArchive = await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "Archived" }));
    if (!active.success || !toArchive.success) throw new Error("setup failed");
    await mockIdeaItemsRepository.archiveIdeaItem(toArchive.data.id);

    const list = await mockIdeaItemsRepository.listIdeaItems(WORKSPACE);
    expect(list.map((i) => i.title)).toEqual(["Active"]);
  });

  it("archived: 'archived' returns only archived items", async () => {
    const active = await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "Active" }));
    const toArchive = await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "Archived" }));
    if (!active.success || !toArchive.success) throw new Error("setup failed");
    await mockIdeaItemsRepository.archiveIdeaItem(toArchive.data.id);

    const list = await mockIdeaItemsRepository.listIdeaItems(WORKSPACE, { archived: "archived" });
    expect(list.map((i) => i.title)).toEqual(["Archived"]);
  });

  it("archived: 'all' returns both", async () => {
    const active = await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "Active" }));
    const toArchive = await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "Archived" }));
    if (!active.success || !toArchive.success) throw new Error("setup failed");
    await mockIdeaItemsRepository.archiveIdeaItem(toArchive.data.id);

    const list = await mockIdeaItemsRepository.listIdeaItems(WORKSPACE, { archived: "all" });
    expect(list).toHaveLength(2);
  });

  it("search matches a plain, case-insensitive substring of the title", async () => {
    await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "Behind the Scenes at a Wedding" }));
    await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "Studio Tour" }));

    const list = await mockIdeaItemsRepository.listIdeaItems(WORKSPACE, { search: "wedding" });
    expect(list.map((i) => i.title)).toEqual(["Behind the Scenes at a Wedding"]);
  });

  it("excludes another workspace's items entirely", async () => {
    await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "Mine" }));
    await mockIdeaItemsRepository.createIdeaItem(createInput({ workspaceId: OTHER_WORKSPACE, title: "Theirs" }));

    const list = await mockIdeaItemsRepository.listIdeaItems(WORKSPACE);
    expect(list.map((i) => i.title)).toEqual(["Mine"]);
  });

  it("orders by created_at descending", async () => {
    const first = await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "First" }));
    const second = await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "Second" }));
    if (!first.success || !second.success) throw new Error("setup failed");

    // Force a deterministic, unambiguous ordering directly in the store —
    // two real `createIdeaItem` calls in the same test tick can land on the
    // identical millisecond, which would make an assertion that relies on
    // wall-clock timing flaky.
    writeIdeaItems(
      readIdeaItems().map((item) => {
        if (item.id === first.data.id) return { ...item, created_at: "2026-01-01T00:00:00.000Z" };
        if (item.id === second.data.id) return { ...item, created_at: "2026-01-02T00:00:00.000Z" };
        return item;
      }),
    );

    const list = await mockIdeaItemsRepository.listIdeaItems(WORKSPACE);
    expect(list.map((i) => i.title)).toEqual(["Second", "First"]);
  });

  it("tie-breaks deterministically by id when created_at is identical", async () => {
    const a = await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "A" }));
    const b = await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "B" }));
    if (!a.success || !b.success) throw new Error("setup failed");

    const list = await mockIdeaItemsRepository.listIdeaItems(WORKSPACE);
    const expectedOrder = [a.data, b.data].sort((x, y) => y.id.localeCompare(x.id)).map((i) => i.title);
    expect(list.map((i) => i.title)).toEqual(expectedOrder);
  });

  it("respects a bounded limit", async () => {
    await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "A" }));
    await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "B" }));
    await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "C" }));

    const list = await mockIdeaItemsRepository.listIdeaItems(WORKSPACE, { limit: 2 });
    expect(list).toHaveLength(2);
  });
});

describe("mockIdeaItemsRepository.updateIdeaItem", () => {
  it("updates only the provided fields, leaving the rest untouched", async () => {
    const created = await mockIdeaItemsRepository.createIdeaItem(createInput({ title: "Original", notes: "Keep me" }));
    if (!created.success) throw new Error("setup failed");

    const updated = await mockIdeaItemsRepository.updateIdeaItem(created.data.id, { title: "Updated" });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.title).toBe("Updated");
    expect(updated.data.notes).toBe("Keep me");
  });

  it("returns not-found for an id that does not exist", async () => {
    const result = await mockIdeaItemsRepository.updateIdeaItem("nope", { title: "X" });
    expect(result.success).toBe(false);
  });

  it("allows clearing an optional field back to null", async () => {
    const created = await mockIdeaItemsRepository.createIdeaItem(createInput({ priority: "high" }));
    if (!created.success) throw new Error("setup failed");

    const updated = await mockIdeaItemsRepository.updateIdeaItem(created.data.id, { priority: null });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.priority).toBeNull();
  });
});

describe("mockIdeaItemsRepository — archive / unarchive", () => {
  it("archives an item, setting status archived and archived_at", async () => {
    const created = await mockIdeaItemsRepository.createIdeaItem(createInput());
    if (!created.success) throw new Error("setup failed");

    const archived = await mockIdeaItemsRepository.archiveIdeaItem(created.data.id);
    expect(archived.success).toBe(true);
    if (!archived.success) return;
    expect(archived.data.status).toBe("archived");
    expect(archived.data.archived_at).not.toBeNull();
  });

  it("archiving an already-archived item is idempotent", async () => {
    const created = await mockIdeaItemsRepository.createIdeaItem(createInput());
    if (!created.success) throw new Error("setup failed");
    await mockIdeaItemsRepository.archiveIdeaItem(created.data.id);
    const secondArchive = await mockIdeaItemsRepository.archiveIdeaItem(created.data.id);
    expect(secondArchive.success).toBe(true);
  });

  it("unarchives an item, restoring status active and clearing archived_at", async () => {
    const created = await mockIdeaItemsRepository.createIdeaItem(createInput());
    if (!created.success) throw new Error("setup failed");
    await mockIdeaItemsRepository.archiveIdeaItem(created.data.id);

    const unarchived = await mockIdeaItemsRepository.unarchiveIdeaItem(created.data.id);
    expect(unarchived.success).toBe(true);
    if (!unarchived.success) return;
    expect(unarchived.data.status).toBe("active");
    expect(unarchived.data.archived_at).toBeNull();
  });

  it("unarchiving an already-active item is idempotent", async () => {
    const created = await mockIdeaItemsRepository.createIdeaItem(createInput());
    if (!created.success) throw new Error("setup failed");
    const result = await mockIdeaItemsRepository.unarchiveIdeaItem(created.data.id);
    expect(result.success).toBe(true);
  });

  it("never deletes the row — archiving still leaves it retrievable by id", async () => {
    const created = await mockIdeaItemsRepository.createIdeaItem(createInput());
    if (!created.success) throw new Error("setup failed");
    await mockIdeaItemsRepository.archiveIdeaItem(created.data.id);
    const fetched = await mockIdeaItemsRepository.getIdeaItemById(created.data.id);
    expect(fetched.id).toBe(created.data.id);
  });
});
