import type {
  MediaKit,
  MediaKitAnalyticsSummary,
  MediaKitBrandInput,
  MediaKitContentStatus,
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

/** Test-only: restore the store to empty between test cases. */
export function resetMediaKitStore(): void {
  mediaKits = [];
  serviceCurations = [];
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

/** MEDIAKIT-03 — brand/services now derive from real store state (documented rule on `MediaKitSectionReadiness`); portfolio/partners/testimonials/press/gallery/contact have no editor yet, so no mock store backs them — truthfully "not_started" until then. */
async function getMediaKitContentStatus(workspaceId: string, mediaKitId: string): Promise<MediaKitContentStatus> {
  await delay(50);
  const mediaKit = mediaKits.find((mk) => mk.id === mediaKitId && mk.workspace_id === workspaceId);

  const brandFieldsAllEmpty = !mediaKit?.headline && !mediaKit?.positioning_statement && !mediaKit?.brand_narrative;
  const brandCoreFieldsFilled = Boolean(mediaKit?.headline && mediaKit?.positioning_statement);
  const brand = brandCoreFieldsFilled ? "ready" : brandFieldsAllEmpty ? "not_started" : "in_progress";

  const curationsForKit = serviceCurations.filter((row) => row.media_kit_id === mediaKitId && row.archived_at === null);
  const anyIncluded = curationsForKit.some((row) => row.is_included);
  const services = curationsForKit.length === 0 ? "not_started" : anyIncluded ? "ready" : "in_progress";

  return {
    brand,
    services,
    portfolio: "not_started",
    partners: "not_started",
    testimonials: "not_started",
    press: "not_started",
    gallery: "not_started",
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
  getMediaKitContentStatus,
  getMediaKitAnalyticsSummary,
  getMediaKitRecentActivity,
};
