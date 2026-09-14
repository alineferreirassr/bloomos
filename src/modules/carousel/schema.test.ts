import { describe, expect, it } from "vitest";
import { carouselItemInputSchema, carouselItemUpdateSchema, carouselSlideInputSchema, carouselSlideUpdateSchema } from "@/modules/carousel/schema";

describe("carouselItemInputSchema", () => {
  it("accepts a valid input", () => {
    const result = carouselItemInputSchema.safeParse({ title: "Autumn wedding carousel", source_idea_id: null });
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = carouselItemInputSchema.safeParse({ title: "", source_idea_id: null });
    expect(result.success).toBe(false);
  });

  it("trims the title", () => {
    const result = carouselItemInputSchema.safeParse({ title: "  Autumn carousel  ", source_idea_id: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Autumn carousel");
  });

  it("normalizes an empty-string source_idea_id to null", () => {
    const result = carouselItemInputSchema.safeParse({ title: "Carousel", source_idea_id: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.source_idea_id).toBeNull();
  });

  it("accepts a real source_idea_id string", () => {
    const result = carouselItemInputSchema.safeParse({ title: "Carousel", source_idea_id: "idea_1" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.source_idea_id).toBe("idea_1");
  });
});

describe("carouselItemUpdateSchema", () => {
  it("accepts a partial update with only title", () => {
    expect(carouselItemUpdateSchema.safeParse({ title: "New title" }).success).toBe(true);
  });

  it("accepts an empty object", () => {
    expect(carouselItemUpdateSchema.safeParse({}).success).toBe(true);
  });
});

describe("carouselSlideInputSchema", () => {
  it("accepts a valid input", () => {
    const result = carouselSlideInputSchema.safeParse({ content: "Slide text", sort_order: 0, media_asset_id: null });
    expect(result.success).toBe(true);
  });

  it("accepts an empty content string — an in-progress slide is valid", () => {
    const result = carouselSlideInputSchema.safeParse({ content: "", sort_order: 0, media_asset_id: null });
    expect(result.success).toBe(true);
  });

  it("rejects a negative sort_order", () => {
    const result = carouselSlideInputSchema.safeParse({ content: "x", sort_order: -1, media_asset_id: null });
    expect(result.success).toBe(false);
  });

  it("rejects a fractional sort_order", () => {
    const result = carouselSlideInputSchema.safeParse({ content: "x", sort_order: 1.5, media_asset_id: null });
    expect(result.success).toBe(false);
  });

  it("accepts sort_order 0 explicitly", () => {
    const result = carouselSlideInputSchema.safeParse({ content: "x", sort_order: 0, media_asset_id: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sort_order).toBe(0);
  });

  it("normalizes an empty-string media_asset_id to null", () => {
    const result = carouselSlideInputSchema.safeParse({ content: "x", sort_order: 0, media_asset_id: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.media_asset_id).toBeNull();
  });

  it("accepts a real media_asset_id string", () => {
    const result = carouselSlideInputSchema.safeParse({ content: "x", sort_order: 0, media_asset_id: "asset_1" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.media_asset_id).toBe("asset_1");
  });
});

describe("carouselSlideUpdateSchema", () => {
  it("accepts a partial update with only content", () => {
    expect(carouselSlideUpdateSchema.safeParse({ content: "Updated" }).success).toBe(true);
  });

  it("accepts an empty object", () => {
    expect(carouselSlideUpdateSchema.safeParse({}).success).toBe(true);
  });
});
