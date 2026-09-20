import type {
  MediaKit,
  MediaKitAnalyticsSummary,
  MediaKitBrandInput,
  MediaKitContentStatus,
  MediaKitGalleryItem,
  MediaKitGalleryItemInput,
  MediaKitPortfolioItem,
  MediaKitPortfolioItemInput,
  MediaKitRecentActivityItem,
  MediaKitServiceCuration,
  MediaKitServiceCurationInput,
} from "@/types/mediaKit";
import type { MediaKitRepository } from "@/lib/data/mediaKit/repository";
import type { DataResult } from "@/lib/data/result";
import { ok, fail } from "@/lib/data/result";
import { generateId, nowIso, delay } from "@/lib/data/utils";

let mediaKits: MediaKit[] = [];
let serviceCurations: MediaKitServiceCuration[] = [];
let portfolioItems: MediaKitPortfolioItem[] = [];
let galleryItems: MediaKitGalleryItem[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetMediaKitStore(): void {
  mediaKits = [];
  serviceCurations = [];
  portfolioItems = [];
  galleryItems = [];
}

function defaultMediaKit(workspaceId: string): MediaKit {
  const now = nowIso();
  return {
    id: generateId("media_kit"),
    workspace_id: workspaceId,
    slug: "amore-bloom",
    headline: null,
    positioning_statement: null,
    brand_narrative: null,
    location_label: null,
    service_area: null,
    established_year: null,
    specialty_label: null,
    contact_headline: null,
    contact_subtext: null,
    primary_cta_label: "Request a Proposal",
    primary_cta_type: "inquiry_form",
    primary_cta_external_url: null,
    secondary_cta_label: null,
    secondary_cta_url: null,
    social_links: [],
    appearance: {},
    status: "draft",
    current_published_snapshot_id: null,
    published_at: null,
    published_by: null,
    created_by: null,
    created_at: now,
    updated_at: now,
    archived_at: null,
  };
}

/** Pure read — never inserts. */
async function getMediaKit(workspaceId: string): Promise<MediaKit | null> {
  await delay(100);
  return mediaKits.find((mk) => mk.workspace_id === workspaceId) ?? null;
}

/** The one explicit creation path. Recovers safely (returns the existing row) on a repeated/double call rather than creating a second one. */
async function createMediaKit(workspaceId: string): Promise<DataResult<MediaKit>> {
  await delay(150);
  const existing = mediaKits.find((mk) => mk.workspace_id === workspaceId);
  if (existing) return ok(existing);
  const created = defaultMediaKit(workspaceId);
  mediaKits = [...mediaKits, created];
  return ok(created);
}

async function updateMediaKitBrand(workspaceId: string, mediaKitId: string, input: MediaKitBrandInput): Promise<DataResult<MediaKit>> {
  await delay(150);
  const index = mediaKits.findIndex((mk) => mk.id === mediaKitId && mk.workspace_id === workspaceId);
  if (index === -1) return fail("This Media Kit could not be found.");
  const updated: MediaKit = { ...mediaKits[index], ...input, updated_at: nowIso() };
  mediaKits = [...mediaKits.slice(0, index), updated, ...mediaKits.slice(index + 1)];
  return ok(updated);
}

async function listMediaKitServiceCurations(workspaceId: string, mediaKitId: string): Promise<MediaKitServiceCuration[]> {
  await delay(80);
  return serviceCurations.filter((row) => row.workspace_id === workspaceId && row.media_kit_id === mediaKitId && row.archived_at === null);
}

async function setMediaKitServiceIncluded(workspaceId: string, mediaKitId: string, serviceId: string, included: boolean): Promise<DataResult<MediaKitServiceCuration>> {
  await delay(120);
  const existingIndex = serviceCurations.findIndex(
    (row) => row.workspace_id === workspaceId && row.media_kit_id === mediaKitId && row.service_id === serviceId && row.archived_at === null,
  );

  if (existingIndex !== -1) {
    const updated: MediaKitServiceCuration = { ...serviceCurations[existingIndex], is_included: included, updated_at: nowIso() };
    serviceCurations = [...serviceCurations.slice(0, existingIndex), updated, ...serviceCurations.slice(existingIndex + 1)];
    return ok(updated);
  }

  if (!included) {
    // Nothing to exclude — no row exists yet. Not an error; simply a no-op the caller can treat as already-excluded.
    return fail("This service hasn't been added to the Media Kit yet.");
  }

  const maxSortOrder = serviceCurations
    .filter((row) => row.media_kit_id === mediaKitId)
    .reduce((max, row) => Math.max(max, row.sort_order), -1);

  const now = nowIso();
  const created: MediaKitServiceCuration = {
    id: generateId("mk_service"),
    workspace_id: workspaceId,
    media_kit_id: mediaKitId,
    service_id: serviceId,
    headline_override: null,
    description_override: null,
    icon_key: null,
    public_starting_price_minor: null,
    public_price_label: null,
    is_featured: false,
    is_included: true,
    sort_order: maxSortOrder + 1,
    created_at: now,
    updated_at: now,
    archived_at: null,
  };
  serviceCurations = [...serviceCurations, created];
  return ok(created);
}

async function updateMediaKitServiceCuration(workspaceId: string, curationId: string, input: MediaKitServiceCurationInput): Promise<DataResult<MediaKitServiceCuration>> {
  await delay(120);
  const index = serviceCurations.findIndex((row) => row.id === curationId && row.workspace_id === workspaceId);
  if (index === -1) return fail("This curated service could not be found.");
  const updated: MediaKitServiceCuration = { ...serviceCurations[index], ...input, updated_at: nowIso() };
  serviceCurations = [...serviceCurations.slice(0, index), updated, ...serviceCurations.slice(index + 1)];
  return ok(updated);
}

async function reorderMediaKitServices(workspaceId: string, mediaKitId: string, orderedCurationIds: string[]): Promise<DataResult<MediaKitServiceCuration[]>> {
  await delay(120);
  const updatedRows: MediaKitServiceCuration[] = [];
  serviceCurations = serviceCurations.map((row) => {
    if (row.workspace_id !== workspaceId || row.media_kit_id !== mediaKitId) return row;
    const position = orderedCurationIds.indexOf(row.id);
    if (position === -1) return row;
    const updated = { ...row, sort_order: position, updated_at: nowIso() };
    updatedRows.push(updated);
    return updated;
  });
  return ok(updatedRows.sort((a, b) => a.sort_order - b.sort_order));
}

// ── MEDIAKIT-04 — Portfolio ────────────────────────────────────────────

async function listMediaKitPortfolioItems(workspaceId: string, mediaKitId: string): Promise<MediaKitPortfolioItem[]> {
  await delay(80);
  return portfolioItems.filter((row) => row.workspace_id === workspaceId && row.media_kit_id === mediaKitId && row.archived_at === null);
}

async function createMediaKitPortfolioItem(workspaceId: string, mediaKitId: string, input: MediaKitPortfolioItemInput): Promise<DataResult<MediaKitPortfolioItem>> {
  await delay(150);
  const maxSortOrder = portfolioItems.filter((row) => row.media_kit_id === mediaKitId).reduce((max, row) => Math.max(max, row.sort_order), -1);
  const now = nowIso();
  const created: MediaKitPortfolioItem = {
    id: generateId("mk_portfolio"),
    workspace_id: workspaceId,
    media_kit_id: mediaKitId,
    ...input,
    sort_order: maxSortOrder + 1,
    created_at: now,
    updated_at: now,
    archived_at: null,
  };
  portfolioItems = [...portfolioItems, created];
  return ok(created);
}

async function updateMediaKitPortfolioItem(workspaceId: string, itemId: string, input: MediaKitPortfolioItemInput): Promise<DataResult<MediaKitPortfolioItem>> {
  await delay(150);
  const index = portfolioItems.findIndex((row) => row.id === itemId && row.workspace_id === workspaceId);
  if (index === -1) return fail("This portfolio item could not be found.");
  const updated: MediaKitPortfolioItem = { ...portfolioItems[index], ...input, updated_at: nowIso() };
  portfolioItems = [...portfolioItems.slice(0, index), updated, ...portfolioItems.slice(index + 1)];
  return ok(updated);
}

async function archiveMediaKitPortfolioItem(workspaceId: string, itemId: string): Promise<DataResult<MediaKitPortfolioItem>> {
  await delay(120);
  const index = portfolioItems.findIndex((row) => row.id === itemId && row.workspace_id === workspaceId);
  if (index === -1) return fail("This portfolio item could not be found.");
  const updated: MediaKitPortfolioItem = { ...portfolioItems[index], archived_at: nowIso(), updated_at: nowIso() };
  portfolioItems = [...portfolioItems.slice(0, index), updated, ...portfolioItems.slice(index + 1)];
  return ok(updated);
}

async function reorderMediaKitPortfolioItems(workspaceId: string, mediaKitId: string, orderedItemIds: string[]): Promise<DataResult<MediaKitPortfolioItem[]>> {
  await delay(120);
  const updatedRows: MediaKitPortfolioItem[] = [];
  portfolioItems = portfolioItems.map((row) => {
    if (row.workspace_id !== workspaceId || row.media_kit_id !== mediaKitId) return row;
    const position = orderedItemIds.indexOf(row.id);
    if (position === -1) return row;
    const updated = { ...row, sort_order: position, updated_at: nowIso() };
    updatedRows.push(updated);
    return updated;
  });
  return ok(updatedRows.sort((a, b) => a.sort_order - b.sort_order));
}

// ── MEDIAKIT-04 — Gallery ──────────────────────────────────────────────

async function listMediaKitGalleryItems(workspaceId: string, mediaKitId: string, portfolioItemId: string | null): Promise<MediaKitGalleryItem[]> {
  await delay(80);
  return galleryItems.filter(
    (row) => row.workspace_id === workspaceId && row.media_kit_id === mediaKitId && row.portfolio_item_id === portfolioItemId && row.archived_at === null,
  );
}

async function addMediaKitGalleryItem(workspaceId: string, mediaKitId: string, portfolioItemId: string | null, mediaAssetId: string): Promise<DataResult<MediaKitGalleryItem>> {
  await delay(150);
  const maxSortOrder = galleryItems
    .filter((row) => row.media_kit_id === mediaKitId && row.portfolio_item_id === portfolioItemId)
    .reduce((max, row) => Math.max(max, row.sort_order), -1);
  const created: MediaKitGalleryItem = {
    id: generateId("mk_gallery"),
    workspace_id: workspaceId,
    media_kit_id: mediaKitId,
    portfolio_item_id: portfolioItemId,
    media_asset_id: mediaAssetId,
    caption: null,
    is_cover: false,
    is_included: true,
    sort_order: maxSortOrder + 1,
    created_at: nowIso(),
    archived_at: null,
  };
  galleryItems = [...galleryItems, created];
  return ok(created);
}

async function updateMediaKitGalleryItem(workspaceId: string, itemId: string, input: MediaKitGalleryItemInput): Promise<DataResult<MediaKitGalleryItem>> {
  await delay(120);
  const index = galleryItems.findIndex((row) => row.id === itemId && row.workspace_id === workspaceId);
  if (index === -1) return fail("This gallery image could not be found.");
  const target = galleryItems[index];

  // At most one cover per (media_kit_id, portfolio_item_id) scope — clear any other cover first.
  if (input.is_cover) {
    galleryItems = galleryItems.map((row) =>
      row.id !== target.id && row.media_kit_id === target.media_kit_id && row.portfolio_item_id === target.portfolio_item_id && row.is_cover
        ? { ...row, is_cover: false }
        : row,
    );
  }

  const updatedIndex = galleryItems.findIndex((row) => row.id === itemId);
  const updated: MediaKitGalleryItem = { ...galleryItems[updatedIndex], ...input };
  galleryItems = [...galleryItems.slice(0, updatedIndex), updated, ...galleryItems.slice(updatedIndex + 1)];
  return ok(updated);
}

async function archiveMediaKitGalleryItem(workspaceId: string, itemId: string): Promise<DataResult<MediaKitGalleryItem>> {
  await delay(120);
  const index = galleryItems.findIndex((row) => row.id === itemId && row.workspace_id === workspaceId);
  if (index === -1) return fail("This gallery image could not be found.");
  const updated: MediaKitGalleryItem = { ...galleryItems[index], archived_at: nowIso() };
  galleryItems = [...galleryItems.slice(0, index), updated, ...galleryItems.slice(index + 1)];
  return ok(updated);
}

async function reorderMediaKitGalleryItems(
  workspaceId: string,
  mediaKitId: string,
  portfolioItemId: string | null,
  orderedItemIds: string[],
): Promise<DataResult<MediaKitGalleryItem[]>> {
  await delay(120);
  const updatedRows: MediaKitGalleryItem[] = [];
  galleryItems = galleryItems.map((row) => {
    if (row.workspace_id !== workspaceId || row.media_kit_id !== mediaKitId || row.portfolio_item_id !== portfolioItemId) return row;
    const position = orderedItemIds.indexOf(row.id);
    if (position === -1) return row;
    const updated = { ...row, sort_order: position };
    updatedRows.push(updated);
    return updated;
  });
  return ok(updatedRows.sort((a, b) => a.sort_order - b.sort_order));
}

// ── MEDIAKIT-04 — Publish ──────────────────────────────────────────────

/**
 * Mock-mode publish never resolves a real `media_kit_published_snapshots`
 * row (there's no mock snapshot store — publish/preview parity isn't this
 * checkpoint's concern in mock mode) — it only flips the same public state
 * `publish_media_kit()` flips on the real `media_kits` row, so the Manager's
 * Publication section and "View Public Page" gating behave truthfully in
 * mock mode too.
 */
async function publishMediaKit(workspaceId: string, mediaKitId: string): Promise<DataResult<MediaKit>> {
  await delay(200);
  const index = mediaKits.findIndex((mk) => mk.id === mediaKitId && mk.workspace_id === workspaceId);
  if (index === -1) return fail("This Media Kit could not be found.");
  const now = nowIso();
  const updated: MediaKit = {
    ...mediaKits[index],
    status: "published",
    published_at: now,
    published_by: null,
    current_published_snapshot_id: generateId("mk_snapshot"),
    updated_at: now,
  };
  mediaKits = [...mediaKits.slice(0, index), updated, ...mediaKits.slice(index + 1)];
  return ok(updated);
}

/** MEDIAKIT-03/04 — brand/services/portfolio/gallery now derive from real store state (documented rule on `MediaKitSectionReadiness`); partners/testimonials/press/contact have no editor yet, so no mock store backs them — truthfully "not_started" until then. */
async function getMediaKitContentStatus(workspaceId: string, mediaKitId: string): Promise<MediaKitContentStatus> {
  await delay(50);
  const mediaKit = mediaKits.find((mk) => mk.id === mediaKitId && mk.workspace_id === workspaceId);

  const brandFieldsAllEmpty = !mediaKit?.headline && !mediaKit?.positioning_statement && !mediaKit?.brand_narrative;
  const brandCoreFieldsFilled = Boolean(mediaKit?.headline && mediaKit?.positioning_statement);
  const brand = brandCoreFieldsFilled ? "ready" : brandFieldsAllEmpty ? "not_started" : "in_progress";

  const curationsForKit = serviceCurations.filter((row) => row.media_kit_id === mediaKitId && row.archived_at === null);
  const anyServiceIncluded = curationsForKit.some((row) => row.is_included);
  const services = curationsForKit.length === 0 ? "not_started" : anyServiceIncluded ? "ready" : "in_progress";

  const portfolioForKit = portfolioItems.filter((row) => row.media_kit_id === mediaKitId && row.archived_at === null);
  const anyPortfolioIncluded = portfolioForKit.some((row) => row.is_included);
  const portfolio = portfolioForKit.length === 0 ? "not_started" : anyPortfolioIncluded ? "ready" : "in_progress";

  const galleryForKit = galleryItems.filter((row) => row.media_kit_id === mediaKitId && row.archived_at === null);
  const anyGalleryIncluded = galleryForKit.some((row) => row.is_included);
  const gallery = galleryForKit.length === 0 ? "not_started" : anyGalleryIncluded ? "ready" : "in_progress";

  return {
    brand,
    services,
    portfolio,
    partners: "not_started",
    testimonials: "not_started",
    press: "not_started",
    gallery,
    contact: mediaKit?.contact_headline || mediaKit?.contact_subtext ? "ready" : "not_started",
  };
}

/** No mock analytics-event store exists yet — a real workspace with zero events truthfully reads all-zero, and mock mode reads the same all-zero shape rather than a distinct "unavailable" state. */
async function getMediaKitAnalyticsSummary(_workspaceId: string, _mediaKitId: string): Promise<MediaKitAnalyticsSummary> {
  await delay(50);
  return { totalViews: 0, approxUniqueVisitors: 0, inquiries: 0, leadsGenerated: 0 };
}

async function getMediaKitRecentActivity(_workspaceId: string, _mediaKitId: string, _limit = 10): Promise<MediaKitRecentActivityItem[]> {
  await delay(50);
  return [];
}

export const mockMediaKitRepository: MediaKitRepository = {
  getMediaKit,
  createMediaKit,
  updateMediaKitBrand,
  listMediaKitServiceCurations,
  setMediaKitServiceIncluded,
  updateMediaKitServiceCuration,
  reorderMediaKitServices,
  listMediaKitPortfolioItems,
  createMediaKitPortfolioItem,
  updateMediaKitPortfolioItem,
  archiveMediaKitPortfolioItem,
  reorderMediaKitPortfolioItems,
  listMediaKitGalleryItems,
  addMediaKitGalleryItem,
  updateMediaKitGalleryItem,
  archiveMediaKitGalleryItem,
  reorderMediaKitGalleryItems,
  publishMediaKit,
  getMediaKitContentStatus,
  getMediaKitAnalyticsSummary,
  getMediaKitRecentActivity,
};
