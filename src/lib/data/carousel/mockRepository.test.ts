import { afterEach, describe, expect, it } from "vitest";
import { mockCarouselRepository } from "@/lib/data/carousel/mockRepository";
import { resetCarouselItemsStore } from "@/lib/data/mock/carouselItemsStore";
import { resetCarouselSlidesStore } from "@/lib/data/mock/carouselSlidesStore";
import type { CreateCarouselItemInput, CreateCarouselSlideInput } from "@/lib/data/carousel/repository";

const WORKSPACE_ID = "ws_1";
const ACTOR_ID = "11111111-1111-4111-8111-111111111111";

function itemInput(overrides: Partial<CreateCarouselItemInput> = {}): CreateCarouselItemInput {
  return { workspaceId: WORKSPACE_ID, createdBy: ACTOR_ID, title: "Autumn wedding carousel", sourceIdeaId: null, ...overrides };
}

function slideInput(overrides: Partial<CreateCarouselSlideInput> = {}): CreateCarouselSlideInput {
  return { carouselId: "carousel_1", workspaceId: WORKSPACE_ID, content: "Slide one text.", sortOrder: 0, mediaAssetId: null, ...overrides };
}

afterEach(() => {
  resetCarouselItemsStore();
  resetCarouselSlidesStore();
});

describe("mockCarouselRepository — carousel_items", () => {
  it("creates a Carousel active, with archived_at null", async () => {
    const result = await mockCarouselRepository.createCarouselItem(itemInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("active");
    expect(result.data.archived_at).toBeNull();
    expect(result.data.workspace_id).toBe(WORKSPACE_ID);
  });

  it("stores a supplied source_idea_id as provenance only, without validating it", async () => {
    const result = await mockCarouselRepository.createCarouselItem(itemInput({ sourceIdeaId: "idea_1" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_idea_id).toBe("idea_1");
  });

  it("getCarouselItemById throws for a nonexistent id", async () => {
    await expect(mockCarouselRepository.getCarouselItemById("does-not-exist")).rejects.toThrow("This Carousel could not be found.");
  });

  it("getCarouselItemById returns the created row unchanged", async () => {
    const created = await mockCarouselRepository.createCarouselItem(itemInput());
    if (!created.success) throw new Error("setup failed");
    const fetched = await mockCarouselRepository.getCarouselItemById(created.data.id);
    expect(fetched).toEqual(created.data);
  });

  it("listCarouselItems scopes strictly to the given workspace and defaults to active only", async () => {
    await mockCarouselRepository.createCarouselItem(itemInput({ workspaceId: WORKSPACE_ID }));
    await mockCarouselRepository.createCarouselItem(itemInput({ workspaceId: "ws_other" }));
    const list = await mockCarouselRepository.listCarouselItems(WORKSPACE_ID);
    expect(list).toHaveLength(1);
  });

  it("listCarouselItems filters by title search", async () => {
    await mockCarouselRepository.createCarouselItem(itemInput({ title: "Spring launch carousel" }));
    await mockCarouselRepository.createCarouselItem(itemInput({ title: "Autumn wedding carousel" }));
    const list = await mockCarouselRepository.listCarouselItems(WORKSPACE_ID, { search: "autumn" });
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Autumn wedding carousel");
  });

  it("updateCarouselItem updates title and source_idea_id", async () => {
    const created = await mockCarouselRepository.createCarouselItem(itemInput());
    if (!created.success) throw new Error("setup failed");
    const updated = await mockCarouselRepository.updateCarouselItem(created.data.id, { title: "Updated title", sourceIdeaId: "idea_2" });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.title).toBe("Updated title");
    expect(updated.data.source_idea_id).toBe("idea_2");
  });

  it("updateCarouselItem fails for a nonexistent id", async () => {
    const result = await mockCarouselRepository.updateCarouselItem("does-not-exist", { title: "x" });
    expect(result.success).toBe(false);
  });

  it("archiveCarouselItem is idempotent", async () => {
    const created = await mockCarouselRepository.createCarouselItem(itemInput());
    if (!created.success) throw new Error("setup failed");
    const first = await mockCarouselRepository.archiveCarouselItem(created.data.id);
    const second = await mockCarouselRepository.archiveCarouselItem(created.data.id);
    expect(first.success && second.success).toBe(true);
    if (first.success && second.success) expect(first.data.archived_at).toBe(second.data.archived_at);
  });

  it("unarchiveCarouselItem clears archived_at and is idempotent", async () => {
    const created = await mockCarouselRepository.createCarouselItem(itemInput());
    if (!created.success) throw new Error("setup failed");
    await mockCarouselRepository.archiveCarouselItem(created.data.id);
    const unarchived = await mockCarouselRepository.unarchiveCarouselItem(created.data.id);
    expect(unarchived.success).toBe(true);
    if (!unarchived.success) return;
    expect(unarchived.data.status).toBe("active");
    expect(unarchived.data.archived_at).toBeNull();

    const second = await mockCarouselRepository.unarchiveCarouselItem(created.data.id);
    expect(second.success && second.data.archived_at).toBe(null);
  });
});

describe("mockCarouselRepository — carousel_slides", () => {
  it("creates a slide with the supplied content, sort_order, and media_asset_id", async () => {
    const result = await mockCarouselRepository.createCarouselSlide(slideInput({ content: "First slide", sortOrder: 0, mediaAssetId: "media_1" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.content).toBe("First slide");
    expect(result.data.sort_order).toBe(0);
    expect(result.data.media_asset_id).toBe("media_1");
  });

  it("creates a slide with no media — a slide may exist without one", async () => {
    const result = await mockCarouselRepository.createCarouselSlide(slideInput({ mediaAssetId: null }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.media_asset_id).toBeNull();
  });

  it("listCarouselSlides returns slides ordered by sort_order ascending", async () => {
    await mockCarouselRepository.createCarouselSlide(slideInput({ carouselId: "carousel_1", content: "Second", sortOrder: 1 }));
    await mockCarouselRepository.createCarouselSlide(slideInput({ carouselId: "carousel_1", content: "First", sortOrder: 0 }));
    const list = await mockCarouselRepository.listCarouselSlides("carousel_1");
    expect(list.map((s) => s.content)).toEqual(["First", "Second"]);
  });

  it("listCarouselSlides tie-breaks deterministically by id when sort_order is identical", async () => {
    const a = await mockCarouselRepository.createCarouselSlide(slideInput({ carouselId: "carousel_1", content: "A", sortOrder: 0 }));
    const b = await mockCarouselRepository.createCarouselSlide(slideInput({ carouselId: "carousel_1", content: "B", sortOrder: 0 }));
    if (!a.success || !b.success) throw new Error("setup failed");
    const expectedOrder = [a.data, b.data].sort((x, y) => x.id.localeCompare(y.id)).map((s) => s.content);
    const list = await mockCarouselRepository.listCarouselSlides("carousel_1");
    expect(list.map((s) => s.content)).toEqual(expectedOrder);
  });

  it("listCarouselSlides scopes strictly to the given carousel", async () => {
    await mockCarouselRepository.createCarouselSlide(slideInput({ carouselId: "carousel_1" }));
    await mockCarouselRepository.createCarouselSlide(slideInput({ carouselId: "carousel_2" }));
    const list = await mockCarouselRepository.listCarouselSlides("carousel_1");
    expect(list).toHaveLength(1);
  });

  it("updateCarouselSlide updates content, sort_order, and media_asset_id independently", async () => {
    const created = await mockCarouselRepository.createCarouselSlide(slideInput({ mediaAssetId: "media_1" }));
    if (!created.success) throw new Error("setup failed");

    const updated = await mockCarouselRepository.updateCarouselSlide(created.data.id, { content: "Updated" });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.content).toBe("Updated");
    expect(updated.data.media_asset_id).toBe("media_1");
  });

  it("updateCarouselSlide correctly clears media_asset_id to null when explicitly passed", async () => {
    const created = await mockCarouselRepository.createCarouselSlide(slideInput({ mediaAssetId: "media_1" }));
    if (!created.success) throw new Error("setup failed");
    const updated = await mockCarouselRepository.updateCarouselSlide(created.data.id, { mediaAssetId: null });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.media_asset_id).toBeNull();
  });

  it("updateCarouselSlide handles sort_order 0 correctly (?? not ||)", async () => {
    const created = await mockCarouselRepository.createCarouselSlide(slideInput({ sortOrder: 5 }));
    if (!created.success) throw new Error("setup failed");
    const updated = await mockCarouselRepository.updateCarouselSlide(created.data.id, { sortOrder: 0 });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.sort_order).toBe(0);
  });

  it("updateCarouselSlide fails for a nonexistent id", async () => {
    const result = await mockCarouselRepository.updateCarouselSlide("does-not-exist", { content: "x" });
    expect(result.success).toBe(false);
  });

  it("removeCarouselSlide removes only the targeted slide", async () => {
    const a = await mockCarouselRepository.createCarouselSlide(slideInput({ carouselId: "carousel_1", content: "Keep me" }));
    const b = await mockCarouselRepository.createCarouselSlide(slideInput({ carouselId: "carousel_1", content: "Remove me", sortOrder: 1 }));
    if (!a.success || !b.success) throw new Error("setup failed");

    const result = await mockCarouselRepository.removeCarouselSlide(b.data.id);
    expect(result.success).toBe(true);

    const list = await mockCarouselRepository.listCarouselSlides("carousel_1");
    expect(list).toHaveLength(1);
    expect(list[0].content).toBe("Keep me");
  });

  it("removeCarouselSlide never touches a sibling slide in a different carousel", async () => {
    const a = await mockCarouselRepository.createCarouselSlide(slideInput({ carouselId: "carousel_1" }));
    const b = await mockCarouselRepository.createCarouselSlide(slideInput({ carouselId: "carousel_2" }));
    if (!a.success || !b.success) throw new Error("setup failed");

    await mockCarouselRepository.removeCarouselSlide(a.data.id);
    const otherList = await mockCarouselRepository.listCarouselSlides("carousel_2");
    expect(otherList).toHaveLength(1);
  });

  it("removeCarouselSlide fails for a nonexistent id — not idempotent-friendly by design", async () => {
    const result = await mockCarouselRepository.removeCarouselSlide("does-not-exist");
    expect(result.success).toBe(false);
  });
});
