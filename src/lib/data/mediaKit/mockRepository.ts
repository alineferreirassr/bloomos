import type { MediaKit, MediaKitAnalyticsSummary, MediaKitContentStatus, MediaKitRecentActivityItem } from "@/types/mediaKit";
import type { MediaKitRepository } from "@/lib/data/mediaKit/repository";
import type { DataResult } from "@/lib/data/result";
import { ok } from "@/lib/data/result";
import { generateId, nowIso, delay } from "@/lib/data/utils";

let mediaKits: MediaKit[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetMediaKitStore(): void {
  mediaKits = [];
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

/** No child-table mock stores exist yet (editing begins MEDIAKIT-03) — every section is truthfully "not_started" until then, since brand fields are also still empty on a freshly created row. */
async function getMediaKitContentStatus(_workspaceId: string, _mediaKitId: string): Promise<MediaKitContentStatus> {
  await delay(50);
  return {
    brand: "not_started",
    services: "not_started",
    portfolio: "not_started",
    partners: "not_started",
    testimonials: "not_started",
    press: "not_started",
    gallery: "not_started",
    contact: "not_started",
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
  getMediaKitContentStatus,
  getMediaKitAnalyticsSummary,
  getMediaKitRecentActivity,
};
