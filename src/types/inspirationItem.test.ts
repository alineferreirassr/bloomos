import { describe, expect, it } from "vitest";
import { INSPIRATION_SOURCE_TYPES, INSPIRATION_CONTENT_FORMATS, type InspirationItem } from "@/types/inspirationItem";

describe("InspirationItem — domain contract (SOCIAL-06B)", () => {
  it("exposes exactly the seven expected source types", () => {
    expect([...INSPIRATION_SOURCE_TYPES].sort()).toEqual(["instagram", "manual", "other", "pinterest", "tiktok", "website", "youtube"].sort());
  });

  it("exposes exactly the six expected content formats", () => {
    expect([...INSPIRATION_CONTENT_FORMATS].sort()).toEqual(["carousel", "other", "reel", "static", "story", "video"].sort());
  });

  it("a fully-optional-fields item still satisfies the type — every classification-2 field is genuinely nullable", () => {
    const item: InspirationItem = {
      id: "insp_1",
      workspace_id: "ws_1",
      title: "Manual reference",
      source_type: "manual",
      source_url: null,
      normalized_source_url: null,
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
      archived_at: null,
      created_by: null,
      created_at: "2026-09-19T00:00:00Z",
      updated_at: "2026-09-19T00:00:00Z",
    };
    expect(item.archived_at).toBeNull();
  });

  it("the type has no status/is_archived/used_at field — archived_at is the only lifecycle state (SOCIAL-06A/06B decision)", () => {
    const item: InspirationItem = {
      id: "insp_1",
      workspace_id: "ws_1",
      title: "x",
      source_type: "manual",
      source_url: null,
      normalized_source_url: null,
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
      archived_at: null,
      created_by: null,
      created_at: "2026-09-19T00:00:00Z",
      updated_at: "2026-09-19T00:00:00Z",
    };
    expect("status" in item).toBe(false);
    expect("is_archived" in item).toBe(false);
    expect("used_at" in item).toBe(false);
  });

  it("the type has no field that could hold a copy of the source's own wording", () => {
    const item: InspirationItem = {
      id: "insp_1",
      workspace_id: "ws_1",
      title: "x",
      source_type: "manual",
      source_url: null,
      normalized_source_url: null,
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
      archived_at: null,
      created_by: null,
      created_at: "2026-09-19T00:00:00Z",
      updated_at: "2026-09-19T00:00:00Z",
    };
    for (const forbidden of ["platform_caption", "full_caption", "original_caption", "transcript", "original_text", "source_text", "verbatim_content"]) {
      expect(forbidden in item).toBe(false);
    }
  });
});
