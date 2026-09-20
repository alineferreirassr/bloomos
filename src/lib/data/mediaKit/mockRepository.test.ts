import { afterEach, describe, expect, it } from "vitest";
import { mockMediaKitRepository, resetMediaKitStore } from "@/lib/data/mediaKit/mockRepository";

describe("mockMediaKitRepository", () => {
  afterEach(() => {
    resetMediaKitStore();
  });

  // MEDIAKIT-02.1 — the founder correction this file exists to guard: a
  // plain read must never persist a row.
  it("getMediaKit returns null for a workspace with no Media Kit — never creates one", async () => {
    const result = await mockMediaKitRepository.getMediaKit("workspace_1");
    expect(result).toBeNull();
  });

  it("repeated getMediaKit calls stay null — read is idempotent, never side-effecting", async () => {
    await mockMediaKitRepository.getMediaKit("workspace_1");
    await mockMediaKitRepository.getMediaKit("workspace_1");
    const result = await mockMediaKitRepository.getMediaKit("workspace_1");
    expect(result).toBeNull();
  });

  it("createMediaKit creates a default row with schema defaults only — no fabricated brand copy, no seeded metrics", async () => {
    const result = await mockMediaKitRepository.createMediaKit("workspace_1");
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.workspace_id).toBe("workspace_1");
    expect(result.data.status).toBe("draft");
    expect(result.data.slug).toBe("amore-bloom");
    expect(result.data.headline).toBeNull();
    expect(result.data.positioning_statement).toBeNull();
    expect(result.data.brand_narrative).toBeNull();
    expect(result.data.social_links).toEqual([]);
    expect(result.data.current_published_snapshot_id).toBeNull();
    expect(result.data.published_at).toBeNull();
  });

  it("getMediaKit finds the row after createMediaKit", async () => {
    await mockMediaKitRepository.createMediaKit("workspace_1");
    const found = await mockMediaKitRepository.getMediaKit("workspace_1");
    expect(found).not.toBeNull();
    expect(found?.workspace_id).toBe("workspace_1");
  });

  it("repeated/double createMediaKit calls never create a duplicate — recovers to the same existing row", async () => {
    const first = await mockMediaKitRepository.createMediaKit("workspace_1");
    const second = await mockMediaKitRepository.createMediaKit("workspace_1");
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.data.id).toBe(first.data.id);
  });

  it("scopes a fresh Media Kit per workspace", async () => {
    const workspaceA = await mockMediaKitRepository.createMediaKit("workspace_a");
    const workspaceB = await mockMediaKitRepository.createMediaKit("workspace_b");
    expect(workspaceA.success && workspaceB.success).toBe(true);
    if (!workspaceA.success || !workspaceB.success) return;
    expect(workspaceA.data.id).not.toBe(workspaceB.data.id);
  });

  it("reports every content section as not_started on a freshly created Media Kit", async () => {
    const created = await mockMediaKitRepository.createMediaKit("workspace_1");
    expect(created.success).toBe(true);
    if (!created.success) return;
    const status = await mockMediaKitRepository.getMediaKitContentStatus("workspace_1", created.data.id);
    for (const value of Object.values(status)) {
      expect(value).toBe("not_started");
    }
  });

  it("reports every analytics figure as a truthful zero, never fabricated, when no events exist", async () => {
    const created = await mockMediaKitRepository.createMediaKit("workspace_1");
    expect(created.success).toBe(true);
    if (!created.success) return;
    const analytics = await mockMediaKitRepository.getMediaKitAnalyticsSummary("workspace_1", created.data.id);
    expect(analytics).toEqual({ totalViews: 0, approxUniqueVisitors: 0, inquiries: 0, leadsGenerated: 0 });
  });

  // MEDIAKIT-03 — Brand editor
  describe("updateMediaKitBrand", () => {
    it("persists the identity/story/location fields", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;

      const result = await mockMediaKitRepository.updateMediaKitBrand("workspace_1", created.data.id, {
        headline: "Modern romance, timelessly told.",
        positioning_statement: "For couples who want their story shown, not staged.",
        brand_narrative: "A longer brand story.",
        location_label: "Charleston, SC",
        service_area: "Southeast",
        established_year: 2019,
        specialty_label: "Editorial Florals",
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.headline).toBe("Modern romance, timelessly told.");
      expect(result.data.established_year).toBe(2019);
    });

    it("leaves fields the founder never filled in genuinely empty — never fabricates brand copy", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;

      const result = await mockMediaKitRepository.updateMediaKitBrand("workspace_1", created.data.id, {
        headline: "Modern romance, timelessly told.",
        positioning_statement: null,
        brand_narrative: null,
        location_label: null,
        service_area: null,
        established_year: null,
        specialty_label: null,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.positioning_statement).toBeNull();
      expect(result.data.brand_narrative).toBeNull();
      expect(result.data.established_year).toBeNull();
    });

    it("fails for a Media Kit id that doesn't belong to the workspace", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;

      const result = await mockMediaKitRepository.updateMediaKitBrand("workspace_2", created.data.id, {
        headline: "Should not persist",
        positioning_statement: null,
        brand_narrative: null,
        location_label: null,
        service_area: null,
        established_year: null,
        specialty_label: null,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Brand readiness rule", () => {
    it("not_started when headline, positioning_statement, and brand_narrative are all empty", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const status = await mockMediaKitRepository.getMediaKitContentStatus("workspace_1", created.data.id);
      expect(status.brand).toBe("not_started");
    });

    it("in_progress once any one of the three brand fields is filled but headline+positioning aren't both set", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      await mockMediaKitRepository.updateMediaKitBrand("workspace_1", created.data.id, {
        headline: null,
        positioning_statement: null,
        brand_narrative: "A longer story, but no headline or positioning yet.",
        location_label: null,
        service_area: null,
        established_year: null,
        specialty_label: null,
      });
      const status = await mockMediaKitRepository.getMediaKitContentStatus("workspace_1", created.data.id);
      expect(status.brand).toBe("in_progress");
    });

    it("ready once both headline and positioning_statement are filled — brand_narrative never required", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      await mockMediaKitRepository.updateMediaKitBrand("workspace_1", created.data.id, {
        headline: "Modern romance, timelessly told.",
        positioning_statement: "For couples who want their story shown, not staged.",
        brand_narrative: null,
        location_label: null,
        service_area: null,
        established_year: null,
        specialty_label: null,
      });
      const status = await mockMediaKitRepository.getMediaKitContentStatus("workspace_1", created.data.id);
      expect(status.brand).toBe("ready");
    });
  });

  // MEDIAKIT-03 — Services curator
  describe("listMediaKitServiceCurations / setMediaKitServiceIncluded", () => {
    it("returns no curation rows for a Media Kit with no Services curated yet", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const rows = await mockMediaKitRepository.listMediaKitServiceCurations("workspace_1", created.data.id);
      expect(rows).toEqual([]);
    });

    it("creates a curation row on first include, with schema defaults and no fabricated overrides", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;

      const result = await mockMediaKitRepository.setMediaKitServiceIncluded("workspace_1", created.data.id, "service_1", true);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.service_id).toBe("service_1");
      expect(result.data.is_included).toBe(true);
      expect(result.data.is_featured).toBe(false);
      expect(result.data.headline_override).toBeNull();
      expect(result.data.description_override).toBeNull();
      expect(result.data.public_starting_price_minor).toBeNull();
    });

    it("including the same Service twice never creates a duplicate curation row — no second Service catalog, no duplicate rows", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;

      await mockMediaKitRepository.setMediaKitServiceIncluded("workspace_1", created.data.id, "service_1", true);
      await mockMediaKitRepository.setMediaKitServiceIncluded("workspace_1", created.data.id, "service_1", true);

      const rows = await mockMediaKitRepository.listMediaKitServiceCurations("workspace_1", created.data.id);
      expect(rows.filter((row) => row.service_id === "service_1")).toHaveLength(1);
    });

    it("excluding updates the existing row's is_included rather than deleting or duplicating it", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;

      await mockMediaKitRepository.setMediaKitServiceIncluded("workspace_1", created.data.id, "service_1", true);
      const excluded = await mockMediaKitRepository.setMediaKitServiceIncluded("workspace_1", created.data.id, "service_1", false);
      expect(excluded.success).toBe(true);
      if (!excluded.success) return;
      expect(excluded.data.is_included).toBe(false);

      const rows = await mockMediaKitRepository.listMediaKitServiceCurations("workspace_1", created.data.id);
      expect(rows.filter((row) => row.service_id === "service_1")).toHaveLength(1);
    });

    it("excluding a Service that was never curated is a soft no-op failure, not a crash", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const result = await mockMediaKitRepository.setMediaKitServiceIncluded("workspace_1", created.data.id, "service_never_curated", false);
      expect(result.success).toBe(false);
    });
  });

  describe("updateMediaKitServiceCuration", () => {
    it("edits overrides, public pricing, and the featured flag on an existing curation row", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const included = await mockMediaKitRepository.setMediaKitServiceIncluded("workspace_1", created.data.id, "service_1", true);
      expect(included.success).toBe(true);
      if (!included.success) return;

      const result = await mockMediaKitRepository.updateMediaKitServiceCuration("workspace_1", included.data.id, {
        headline_override: "Signature Design Package",
        description_override: "A custom override description.",
        public_starting_price_minor: 250000,
        public_price_label: "Starting at",
        is_featured: true,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.headline_override).toBe("Signature Design Package");
      expect(result.data.public_starting_price_minor).toBe(250000);
      expect(result.data.is_featured).toBe(true);
    });

    it("an empty override stays genuinely empty (null) — never silently copies canonical text in", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const included = await mockMediaKitRepository.setMediaKitServiceIncluded("workspace_1", created.data.id, "service_1", true);
      expect(included.success).toBe(true);
      if (!included.success) return;

      // The curation row was just created via setMediaKitServiceIncluded with
      // no override editing performed at all — its overrides must still be
      // null (canonical-fallback), not populated with any fabricated text.
      const rows = await mockMediaKitRepository.listMediaKitServiceCurations("workspace_1", created.data.id);
      const row = rows.find((r) => r.service_id === "service_1");
      expect(row?.headline_override).toBeNull();
      expect(row?.description_override).toBeNull();
    });
  });

  describe("reorderMediaKitServices", () => {
    it("assigns sort_order from the given array's position", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;

      const first = await mockMediaKitRepository.setMediaKitServiceIncluded("workspace_1", created.data.id, "service_1", true);
      const second = await mockMediaKitRepository.setMediaKitServiceIncluded("workspace_1", created.data.id, "service_2", true);
      expect(first.success && second.success).toBe(true);
      if (!first.success || !second.success) return;

      const reordered = await mockMediaKitRepository.reorderMediaKitServices("workspace_1", created.data.id, [second.data.id, first.data.id]);
      expect(reordered.success).toBe(true);
      if (!reordered.success) return;

      const bySecond = reordered.data.find((row) => row.id === second.data.id);
      const byFirst = reordered.data.find((row) => row.id === first.data.id);
      expect(bySecond?.sort_order).toBe(0);
      expect(byFirst?.sort_order).toBe(1);
    });
  });

  describe("Services readiness rule", () => {
    it("not_started when zero curation rows exist", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const status = await mockMediaKitRepository.getMediaKitContentStatus("workspace_1", created.data.id);
      expect(status.services).toBe("not_started");
    });

    it("in_progress when curation rows exist but none are included", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const included = await mockMediaKitRepository.setMediaKitServiceIncluded("workspace_1", created.data.id, "service_1", true);
      expect(included.success).toBe(true);
      if (!included.success) return;
      await mockMediaKitRepository.setMediaKitServiceIncluded("workspace_1", created.data.id, "service_1", false);

      const status = await mockMediaKitRepository.getMediaKitContentStatus("workspace_1", created.data.id);
      expect(status.services).toBe("in_progress");
    });

    it("ready when at least one non-archived curation row is included", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      await mockMediaKitRepository.setMediaKitServiceIncluded("workspace_1", created.data.id, "service_1", true);

      const status = await mockMediaKitRepository.getMediaKitContentStatus("workspace_1", created.data.id);
      expect(status.services).toBe("ready");
    });
  });

  // MEDIAKIT-04 — Portfolio
  describe("Portfolio", () => {
    async function createKit() {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      if (!created.success) throw new Error("setup failed");
      return created.data;
    }

    it("creates a portfolio item with schema defaults and no fabricated content", async () => {
      const mediaKit = await createKit();
      const result = await mockMediaKitRepository.createMediaKitPortfolioItem("workspace_1", mediaKit.id, {
        event_id: null,
        title: "Editorial Garden Shoot",
        category: null,
        location_label: null,
        event_year: null,
        short_description: null,
        cover_media_asset_id: null,
        is_featured: false,
        is_included: true,
      });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.title).toBe("Editorial Garden Shoot");
      expect(result.data.event_id).toBeNull();
      expect(result.data.sort_order).toBe(0);
    });

    it("supports a standalone item with no linked Event at all", async () => {
      const mediaKit = await createKit();
      const result = await mockMediaKitRepository.createMediaKitPortfolioItem("workspace_1", mediaKit.id, {
        event_id: null,
        title: "Styled Shoot — No Event",
        category: "Editorial",
        location_label: null,
        event_year: 2025,
        short_description: null,
        cover_media_asset_id: null,
        is_featured: false,
        is_included: true,
      });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.event_id).toBeNull();
    });

    it("supports a portfolio item that reuses an existing Event via event_id, without duplicating it", async () => {
      const mediaKit = await createKit();
      const result = await mockMediaKitRepository.createMediaKitPortfolioItem("workspace_1", mediaKit.id, {
        event_id: "event_123",
        title: "The Harrington Wedding",
        category: "Wedding",
        location_label: "Charleston, SC",
        event_year: 2025,
        short_description: null,
        cover_media_asset_id: null,
        is_featured: false,
        is_included: true,
      });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.event_id).toBe("event_123");
    });

    it("edits title/category/location/year/description on an existing item", async () => {
      const mediaKit = await createKit();
      const created = await mockMediaKitRepository.createMediaKitPortfolioItem("workspace_1", mediaKit.id, {
        event_id: null,
        title: "Draft Title",
        category: null,
        location_label: null,
        event_year: null,
        short_description: null,
        cover_media_asset_id: null,
        is_featured: false,
        is_included: true,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;

      const updated = await mockMediaKitRepository.updateMediaKitPortfolioItem("workspace_1", created.data.id, {
        event_id: null,
        title: "Final Title",
        category: "Editorial",
        location_label: "Savannah, GA",
        event_year: 2024,
        short_description: "A short editorial description.",
        cover_media_asset_id: null,
        is_featured: false,
        is_included: true,
      });
      expect(updated.success).toBe(true);
      if (!updated.success) return;
      expect(updated.data.title).toBe("Final Title");
      expect(updated.data.location_label).toBe("Savannah, GA");
    });

    it("include/exclude toggles is_included without creating a duplicate row", async () => {
      const mediaKit = await createKit();
      const created = await mockMediaKitRepository.createMediaKitPortfolioItem("workspace_1", mediaKit.id, {
        event_id: null,
        title: "Item",
        category: null,
        location_label: null,
        event_year: null,
        short_description: null,
        cover_media_asset_id: null,
        is_featured: false,
        is_included: true,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;

      const excluded = await mockMediaKitRepository.updateMediaKitPortfolioItem("workspace_1", created.data.id, { ...created.data, is_included: false });
      expect(excluded.success).toBe(true);
      if (!excluded.success) return;
      expect(excluded.data.is_included).toBe(false);

      const items = await mockMediaKitRepository.listMediaKitPortfolioItems("workspace_1", mediaKit.id);
      expect(items).toHaveLength(1);
    });

    it("featured toggle persists independently of inclusion", async () => {
      const mediaKit = await createKit();
      const created = await mockMediaKitRepository.createMediaKitPortfolioItem("workspace_1", mediaKit.id, {
        event_id: null,
        title: "Item",
        category: null,
        location_label: null,
        event_year: null,
        short_description: null,
        cover_media_asset_id: null,
        is_featured: false,
        is_included: true,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;

      const featured = await mockMediaKitRepository.updateMediaKitPortfolioItem("workspace_1", created.data.id, { ...created.data, is_featured: true });
      expect(featured.success).toBe(true);
      if (!featured.success) return;
      expect(featured.data.is_featured).toBe(true);
      expect(featured.data.is_included).toBe(true);
    });

    it("archive removes an item from the active list without a hard delete (no delete RLS policy exists on this table)", async () => {
      const mediaKit = await createKit();
      const created = await mockMediaKitRepository.createMediaKitPortfolioItem("workspace_1", mediaKit.id, {
        event_id: null,
        title: "Item",
        category: null,
        location_label: null,
        event_year: null,
        short_description: null,
        cover_media_asset_id: null,
        is_featured: false,
        is_included: true,
      });
      expect(created.success).toBe(true);
      if (!created.success) return;

      const archived = await mockMediaKitRepository.archiveMediaKitPortfolioItem("workspace_1", created.data.id);
      expect(archived.success).toBe(true);
      if (!archived.success) return;
      expect(archived.data.archived_at).not.toBeNull();

      const items = await mockMediaKitRepository.listMediaKitPortfolioItems("workspace_1", mediaKit.id);
      expect(items).toHaveLength(0);
    });

    it("reorder assigns sort_order from the given array's position", async () => {
      const mediaKit = await createKit();
      const first = await mockMediaKitRepository.createMediaKitPortfolioItem("workspace_1", mediaKit.id, {
        event_id: null,
        title: "First",
        category: null,
        location_label: null,
        event_year: null,
        short_description: null,
        cover_media_asset_id: null,
        is_featured: false,
        is_included: true,
      });
      const second = await mockMediaKitRepository.createMediaKitPortfolioItem("workspace_1", mediaKit.id, {
        event_id: null,
        title: "Second",
        category: null,
        location_label: null,
        event_year: null,
        short_description: null,
        cover_media_asset_id: null,
        is_featured: false,
        is_included: true,
      });
      expect(first.success && second.success).toBe(true);
      if (!first.success || !second.success) return;

      const reordered = await mockMediaKitRepository.reorderMediaKitPortfolioItems("workspace_1", mediaKit.id, [second.data.id, first.data.id]);
      expect(reordered.success).toBe(true);
      if (!reordered.success) return;
      expect(reordered.data.find((row) => row.id === second.data.id)?.sort_order).toBe(0);
      expect(reordered.data.find((row) => row.id === first.data.id)?.sort_order).toBe(1);
    });
  });

  describe("Portfolio readiness rule", () => {
    it("not_started when zero portfolio items exist", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const status = await mockMediaKitRepository.getMediaKitContentStatus("workspace_1", created.data.id);
      expect(status.portfolio).toBe("not_started");
    });

    it("in_progress when items exist but none are included", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      await mockMediaKitRepository.createMediaKitPortfolioItem("workspace_1", created.data.id, {
        event_id: null,
        title: "Item",
        category: null,
        location_label: null,
        event_year: null,
        short_description: null,
        cover_media_asset_id: null,
        is_featured: false,
        is_included: false,
      });
      const status = await mockMediaKitRepository.getMediaKitContentStatus("workspace_1", created.data.id);
      expect(status.portfolio).toBe("in_progress");
    });

    it("ready when at least one non-archived item is included", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      await mockMediaKitRepository.createMediaKitPortfolioItem("workspace_1", created.data.id, {
        event_id: null,
        title: "Item",
        category: null,
        location_label: null,
        event_year: null,
        short_description: null,
        cover_media_asset_id: null,
        is_featured: false,
        is_included: true,
      });
      const status = await mockMediaKitRepository.getMediaKitContentStatus("workspace_1", created.data.id);
      expect(status.portfolio).toBe("ready");
    });
  });

  // MEDIAKIT-04 — Gallery
  describe("Gallery", () => {
    it("curates an EXISTING media asset — never creates a second asset library", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const result = await mockMediaKitRepository.addMediaKitGalleryItem("workspace_1", created.data.id, null, "asset_1");
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.media_asset_id).toBe("asset_1");
      expect(result.data.is_included).toBe(true);
      expect(result.data.is_cover).toBe(false);
    });

    it("top-level gallery (portfolio_item_id null) and a portfolio item's own gallery are scoped separately", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const portfolioItem = await mockMediaKitRepository.createMediaKitPortfolioItem("workspace_1", created.data.id, {
        event_id: null,
        title: "Item",
        category: null,
        location_label: null,
        event_year: null,
        short_description: null,
        cover_media_asset_id: null,
        is_featured: false,
        is_included: true,
      });
      expect(portfolioItem.success).toBe(true);
      if (!portfolioItem.success) return;

      await mockMediaKitRepository.addMediaKitGalleryItem("workspace_1", created.data.id, null, "asset_top_level");
      await mockMediaKitRepository.addMediaKitGalleryItem("workspace_1", created.data.id, portfolioItem.data.id, "asset_portfolio_item");

      const topLevel = await mockMediaKitRepository.listMediaKitGalleryItems("workspace_1", created.data.id, null);
      const itemGallery = await mockMediaKitRepository.listMediaKitGalleryItems("workspace_1", created.data.id, portfolioItem.data.id);
      expect(topLevel.map((row) => row.media_asset_id)).toEqual(["asset_top_level"]);
      expect(itemGallery.map((row) => row.media_asset_id)).toEqual(["asset_portfolio_item"]);
    });

    it("include/exclude toggles is_included", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const added = await mockMediaKitRepository.addMediaKitGalleryItem("workspace_1", created.data.id, null, "asset_1");
      expect(added.success).toBe(true);
      if (!added.success) return;

      const excluded = await mockMediaKitRepository.updateMediaKitGalleryItem("workspace_1", added.data.id, { caption: null, is_cover: false, is_included: false });
      expect(excluded.success).toBe(true);
      if (!excluded.success) return;
      expect(excluded.data.is_included).toBe(false);
    });

    it("setting is_cover clears any other cover within the same scope — at most one cover", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const first = await mockMediaKitRepository.addMediaKitGalleryItem("workspace_1", created.data.id, null, "asset_1");
      const second = await mockMediaKitRepository.addMediaKitGalleryItem("workspace_1", created.data.id, null, "asset_2");
      expect(first.success && second.success).toBe(true);
      if (!first.success || !second.success) return;

      await mockMediaKitRepository.updateMediaKitGalleryItem("workspace_1", first.data.id, { caption: null, is_cover: true, is_included: true });
      await mockMediaKitRepository.updateMediaKitGalleryItem("workspace_1", second.data.id, { caption: null, is_cover: true, is_included: true });

      const items = await mockMediaKitRepository.listMediaKitGalleryItems("workspace_1", created.data.id, null);
      const covers = items.filter((row) => row.is_cover);
      expect(covers).toHaveLength(1);
      expect(covers[0]?.media_asset_id).toBe("asset_2");
    });

    it("reorder assigns sort_order from the given array's position, scoped to one gallery", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const first = await mockMediaKitRepository.addMediaKitGalleryItem("workspace_1", created.data.id, null, "asset_1");
      const second = await mockMediaKitRepository.addMediaKitGalleryItem("workspace_1", created.data.id, null, "asset_2");
      expect(first.success && second.success).toBe(true);
      if (!first.success || !second.success) return;

      const reordered = await mockMediaKitRepository.reorderMediaKitGalleryItems("workspace_1", created.data.id, null, [second.data.id, first.data.id]);
      expect(reordered.success).toBe(true);
      if (!reordered.success) return;
      expect(reordered.data.find((row) => row.id === second.data.id)?.sort_order).toBe(0);
      expect(reordered.data.find((row) => row.id === first.data.id)?.sort_order).toBe(1);
    });

    it("archive removes an image from the active list without a hard delete", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const added = await mockMediaKitRepository.addMediaKitGalleryItem("workspace_1", created.data.id, null, "asset_1");
      expect(added.success).toBe(true);
      if (!added.success) return;

      const archived = await mockMediaKitRepository.archiveMediaKitGalleryItem("workspace_1", added.data.id);
      expect(archived.success).toBe(true);
      if (!archived.success) return;
      expect(archived.data.archived_at).not.toBeNull();

      const items = await mockMediaKitRepository.listMediaKitGalleryItems("workspace_1", created.data.id, null);
      expect(items).toHaveLength(0);
    });
  });

  describe("Gallery readiness rule", () => {
    it("not_started when zero gallery items exist (top-level or per-portfolio-item)", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const status = await mockMediaKitRepository.getMediaKitContentStatus("workspace_1", created.data.id);
      expect(status.gallery).toBe("not_started");
    });

    it("in_progress when gallery items exist but none are included", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const added = await mockMediaKitRepository.addMediaKitGalleryItem("workspace_1", created.data.id, null, "asset_1");
      expect(added.success).toBe(true);
      if (!added.success) return;
      await mockMediaKitRepository.updateMediaKitGalleryItem("workspace_1", added.data.id, { caption: null, is_cover: false, is_included: false });

      const status = await mockMediaKitRepository.getMediaKitContentStatus("workspace_1", created.data.id);
      expect(status.gallery).toBe("in_progress");
    });

    it("ready when at least one included gallery item exists", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      await mockMediaKitRepository.addMediaKitGalleryItem("workspace_1", created.data.id, null, "asset_1");

      const status = await mockMediaKitRepository.getMediaKitContentStatus("workspace_1", created.data.id);
      expect(status.gallery).toBe("ready");
    });
  });

  // MEDIAKIT-04 — Publish
  describe("publishMediaKit", () => {
    it("flips status to published and sets a snapshot pointer", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      expect(created.data.status).toBe("draft");

      const published = await mockMediaKitRepository.publishMediaKit("workspace_1", created.data.id);
      expect(published.success).toBe(true);
      if (!published.success) return;
      expect(published.data.status).toBe("published");
      expect(published.data.published_at).not.toBeNull();
      expect(published.data.current_published_snapshot_id).not.toBeNull();
    });

    it("fails for a Media Kit id that doesn't belong to the workspace", async () => {
      const created = await mockMediaKitRepository.createMediaKit("workspace_1");
      expect(created.success).toBe(true);
      if (!created.success) return;
      const result = await mockMediaKitRepository.publishMediaKit("workspace_2", created.data.id);
      expect(result.success).toBe(false);
    });
  });
});
