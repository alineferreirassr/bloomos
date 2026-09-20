import { createClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type {
  MediaKit,
  MediaKitAnalyticsSummary,
  MediaKitBrandInput,
  MediaKitContentStatus,
  MediaKitEventType,
  MediaKitRecentActivityItem,
  MediaKitServiceCuration,
  MediaKitServiceCurationInput,
} from "@/types/mediaKit";
import type { MediaKitRepository } from "@/lib/data/mediaKit/repository";
import type { DataResult } from "@/lib/data/result";
import { ok, fail } from "@/lib/data/result";

interface MediaKitServiceCurationRow {
  id: string;
  workspace_id: string;
  media_kit_id: string;
  service_id: string;
  headline_override: string | null;
  description_override: string | null;
  icon_key: string | null;
  public_starting_price_minor: number | null;
  public_price_label: string | null;
  is_featured: boolean;
  is_included: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

function mapMediaKitServiceCurationRow(row: MediaKitServiceCurationRow): MediaKitServiceCuration {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    media_kit_id: row.media_kit_id,
    service_id: row.service_id,
    headline_override: row.headline_override,
    description_override: row.description_override,
    icon_key: row.icon_key,
    public_starting_price_minor: row.public_starting_price_minor,
    public_price_label: row.public_price_label,
    is_featured: row.is_featured,
    is_included: row.is_included,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

interface MediaKitRow {
  id: string;
  workspace_id: string;
  slug: string;
  headline: string | null;
  positioning_statement: string | null;
  brand_narrative: string | null;
  location_label: string | null;
  service_area: string | null;
  established_year: number | null;
  specialty_label: string | null;
  contact_headline: string | null;
  contact_subtext: string | null;
  primary_cta_label: string;
  primary_cta_type: "inquiry_form" | "external_url";
  primary_cta_external_url: string | null;
  secondary_cta_label: string | null;
  secondary_cta_url: string | null;
  social_links: unknown;
  appearance: unknown;
  status: "draft" | "published" | "unpublished";
  current_published_snapshot_id: string | null;
  published_at: string | null;
  published_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

function mapMediaKitRow(row: MediaKitRow): MediaKit {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    slug: row.slug,
    headline: row.headline,
    positioning_statement: row.positioning_statement,
    brand_narrative: row.brand_narrative,
    location_label: row.location_label,
    service_area: row.service_area,
    established_year: row.established_year,
    specialty_label: row.specialty_label,
    contact_headline: row.contact_headline,
    contact_subtext: row.contact_subtext,
    primary_cta_label: row.primary_cta_label,
    primary_cta_type: row.primary_cta_type,
    primary_cta_external_url: row.primary_cta_external_url,
    secondary_cta_label: row.secondary_cta_label,
    secondary_cta_url: row.secondary_cta_url,
    social_links: Array.isArray(row.social_links) ? row.social_links : [],
    appearance: (row.appearance as Record<string, unknown>) ?? {},
    status: row.status,
    current_published_snapshot_id: row.current_published_snapshot_id,
    published_at: row.published_at,
    published_by: row.published_by,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

/**
 * Plain authenticated, RLS-enforced access throughout — `media_kits` and
 * every child table are `select`/`insert`/`update` `to authenticated` +
 * `is_workspace_member(workspace_id)` (see
 * supabase/migrations/20260929100200_media_kit_foundation.sql). No
 * service-role client is used anywhere in this file: the Manager is an
 * ordinary authenticated surface, exactly like Services/Clients/Events, and
 * has no need to bypass RLS.
 */
/** Pure read — never inserts. Returns `null` if the workspace has no Media Kit yet, so a plain page load can never create one. */
async function getMediaKit(workspaceId: string): Promise<MediaKit | null> {
  const supabase = await createClient();

  const { data: existing, error: selectError } = await supabase
    .from("media_kits")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .maybeSingle();
  if (selectError) throw normalizeSupabaseError(selectError);
  if (!existing) return null;
  return mapMediaKitRow(existing as MediaKitRow);
}

/**
 * MEDIAKIT-02.1 — the one explicit creation path, called only from the
 * founder's own "Create Media Kit" action, never from a read/page-load
 * path. Schema defaults only — no fabricated brand copy, no seeded
 * metrics, no fake achievements. The `unique(workspace_id)` constraint
 * means a race with another concurrent create just surfaces as a
 * duplicate-key error on the losing insert; re-reading on that specific
 * failure recovers cleanly instead of surfacing a broken experience.
 */
async function createMediaKit(workspaceId: string): Promise<DataResult<MediaKit>> {
  const supabase = await createClient();

  const { data: created, error: insertError } = await supabase
    .from("media_kits")
    .insert({ workspace_id: workspaceId })
    .select("*")
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raceWinner, error: raceSelectError } = await supabase
        .from("media_kits")
        .select("*")
        .eq("workspace_id", workspaceId)
        .single();
      if (raceSelectError) throw normalizeSupabaseError(raceSelectError);
      return ok(mapMediaKitRow(raceWinner as MediaKitRow));
    }
    throw normalizeSupabaseError(insertError);
  }
  return ok(mapMediaKitRow(created as MediaKitRow));
}

/** MEDIAKIT-03 — updates only the Brand identity/story/location fields. RLS-enforced (`is_workspace_member`), no service-role bypass. */
async function updateMediaKitBrand(workspaceId: string, mediaKitId: string, input: MediaKitBrandInput): Promise<DataResult<MediaKit>> {
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("media_kits")
    .update({
      headline: input.headline,
      positioning_statement: input.positioning_statement,
      brand_narrative: input.brand_narrative,
      location_label: input.location_label,
      service_area: input.service_area,
      established_year: input.established_year,
      specialty_label: input.specialty_label,
    })
    .eq("id", mediaKitId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!updated) return fail("This Media Kit could not be found.");
  return ok(mapMediaKitRow(updated as MediaKitRow));
}

async function listMediaKitServiceCurations(workspaceId: string, mediaKitId: string): Promise<MediaKitServiceCuration[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("media_kit_services")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("media_kit_id", mediaKitId)
    .is("archived_at", null);
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map((row) => mapMediaKitServiceCurationRow(row as MediaKitServiceCurationRow));
}

/**
 * Get-or-create toggle, mirroring the `media_kits` bootstrap precedent.
 * `included: false` on a Service with no existing row is a no-op/soft
 * failure — nothing to exclude. On first include, `sort_order` is appended
 * after the current maximum rather than reset to 0, so a Service excluded
 * and re-included later doesn't jump back to the front of the list.
 */
async function setMediaKitServiceIncluded(
  workspaceId: string,
  mediaKitId: string,
  serviceId: string,
  included: boolean,
): Promise<DataResult<MediaKitServiceCuration>> {
  const supabase = await createClient();

  const { data: existing, error: selectError } = await supabase
    .from("media_kit_services")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("media_kit_id", mediaKitId)
    .eq("service_id", serviceId)
    .is("archived_at", null)
    .maybeSingle();
  if (selectError) throw normalizeSupabaseError(selectError);

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("media_kit_services")
      .update({ is_included: included })
      .eq("id", (existing as MediaKitServiceCurationRow).id)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();
    if (updateError) throw normalizeSupabaseError(updateError);
    return ok(mapMediaKitServiceCurationRow(updated as MediaKitServiceCurationRow));
  }

  if (!included) {
    return fail("This service hasn't been added to the Media Kit yet.");
  }

  const { data: maxSortRow, error: maxSortError } = await supabase
    .from("media_kit_services")
    .select("sort_order")
    .eq("media_kit_id", mediaKitId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxSortError) throw normalizeSupabaseError(maxSortError);
  const nextSortOrder = maxSortRow ? (maxSortRow as { sort_order: number }).sort_order + 1 : 0;

  const { data: created, error: insertError } = await supabase
    .from("media_kit_services")
    .insert({
      workspace_id: workspaceId,
      media_kit_id: mediaKitId,
      service_id: serviceId,
      is_included: true,
      sort_order: nextSortOrder,
    })
    .select("*")
    .single();
  if (insertError) throw normalizeSupabaseError(insertError);
  return ok(mapMediaKitServiceCurationRow(created as MediaKitServiceCurationRow));
}

async function updateMediaKitServiceCuration(
  workspaceId: string,
  curationId: string,
  input: MediaKitServiceCurationInput,
): Promise<DataResult<MediaKitServiceCuration>> {
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("media_kit_services")
    .update({
      headline_override: input.headline_override,
      description_override: input.description_override,
      public_starting_price_minor: input.public_starting_price_minor,
      public_price_label: input.public_price_label,
      is_featured: input.is_featured,
    })
    .eq("id", curationId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!updated) return fail("This curated service could not be found.");
  return ok(mapMediaKitServiceCurationRow(updated as MediaKitServiceCurationRow));
}

/** Batch reorder — one row-by-row update per id, mirroring `reorderContractExhibits`'s array-position-as-sort_order shape rather than one PATCH per drag/move in the UI. */
async function reorderMediaKitServices(
  workspaceId: string,
  mediaKitId: string,
  orderedCurationIds: string[],
): Promise<DataResult<MediaKitServiceCuration[]>> {
  const supabase = await createClient();

  const updated = await Promise.all(
    orderedCurationIds.map(async (curationId, position) => {
      const { data, error } = await supabase
        .from("media_kit_services")
        .update({ sort_order: position })
        .eq("id", curationId)
        .eq("workspace_id", workspaceId)
        .eq("media_kit_id", mediaKitId)
        .select("*")
        .maybeSingle();
      if (error) throw normalizeSupabaseError(error);
      return data ? mapMediaKitServiceCurationRow(data as MediaKitServiceCurationRow) : null;
    }),
  );

  const rows = updated.filter((row): row is MediaKitServiceCuration => row !== null);
  return ok(rows.sort((a, b) => a.sort_order - b.sort_order));
}

async function countIncludedRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "media_kit_services" | "media_kit_portfolio_items" | "media_kit_partners" | "media_kit_press_features",
  mediaKitId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("media_kit_id", mediaKitId)
    .eq("is_included", true)
    .is("archived_at", null);
  if (error) throw normalizeSupabaseError(error);
  return count ?? 0;
}

async function getMediaKitContentStatus(workspaceId: string, mediaKitId: string): Promise<MediaKitContentStatus> {
  const supabase = await createClient();

  const { data: mediaKitRow, error: mediaKitError } = await supabase
    .from("media_kits")
    .select("headline, positioning_statement, brand_narrative, contact_headline, contact_subtext")
    .eq("id", mediaKitId)
    .eq("workspace_id", workspaceId)
    .single();
  if (mediaKitError) throw normalizeSupabaseError(mediaKitError);

  const brandFieldsAllEmpty = !mediaKitRow.headline && !mediaKitRow.positioning_statement && !mediaKitRow.brand_narrative;
  const brandCoreFieldsFilled = Boolean(mediaKitRow.headline && mediaKitRow.positioning_statement);
  const brand = brandCoreFieldsFilled ? "ready" : brandFieldsAllEmpty ? "not_started" : "in_progress";
  const contactReady = Boolean(mediaKitRow.contact_headline || mediaKitRow.contact_subtext);

  const { count: totalServiceCurations, error: totalServiceCurationsError } = await supabase
    .from("media_kit_services")
    .select("id", { count: "exact", head: true })
    .eq("media_kit_id", mediaKitId)
    .is("archived_at", null);
  if (totalServiceCurationsError) throw normalizeSupabaseError(totalServiceCurationsError);

  const [includedServicesCount, portfolioCount, partnersCount, pressCount] = await Promise.all([
    countIncludedRows(supabase, "media_kit_services", mediaKitId),
    countIncludedRows(supabase, "media_kit_portfolio_items", mediaKitId),
    countIncludedRows(supabase, "media_kit_partners", mediaKitId),
    countIncludedRows(supabase, "media_kit_press_features", mediaKitId),
  ]);

  const services = (totalServiceCurations ?? 0) === 0 ? "not_started" : includedServicesCount > 0 ? "ready" : "in_progress";

  const { count: testimonialsCount, error: testimonialsError } = await supabase
    .from("media_kit_testimonials")
    .select("id", { count: "exact", head: true })
    .eq("media_kit_id", mediaKitId)
    .eq("is_included", true)
    .eq("is_approved", true)
    .is("archived_at", null);
  if (testimonialsError) throw normalizeSupabaseError(testimonialsError);

  const { count: galleryCount, error: galleryError } = await supabase
    .from("media_kit_gallery_items")
    .select("id", { count: "exact", head: true })
    .eq("media_kit_id", mediaKitId)
    .eq("is_included", true)
    .is("portfolio_item_id", null);
  if (galleryError) throw normalizeSupabaseError(galleryError);

  return {
    brand,
    services,
    portfolio: portfolioCount > 0 ? "ready" : "not_started",
    partners: partnersCount > 0 ? "ready" : "not_started",
    testimonials: (testimonialsCount ?? 0) > 0 ? "ready" : "not_started",
    press: pressCount > 0 ? "ready" : "not_started",
    gallery: (galleryCount ?? 0) > 0 ? "ready" : "not_started",
    contact: contactReady ? "ready" : "not_started",
  };
}

async function getMediaKitAnalyticsSummary(workspaceId: string, mediaKitId: string): Promise<MediaKitAnalyticsSummary> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("media_kit_view_events")
    .select("event_type, visitor_hash")
    .eq("workspace_id", workspaceId)
    .eq("media_kit_id", mediaKitId);
  if (error) throw normalizeSupabaseError(error);

  const rows = (data ?? []) as { event_type: MediaKitEventType; visitor_hash: string | null }[];
  const totalViews = rows.filter((row) => row.event_type === "viewed").length;
  const inquiries = rows.filter((row) => row.event_type === "inquiry_submitted").length;
  const uniqueHashes = new Set(rows.filter((row) => row.event_type === "viewed" && row.visitor_hash).map((row) => row.visitor_hash));

  // Leads Generated derives from the Lead side (source = "Media Kit"), not
  // from counting inquiry_submitted events — an event can exist without a
  // Lead only in a failure case the inquiry flow (MEDIAKIT-08) explicitly
  // avoids creating, but reading the Lead itself is the truthful source of
  // record rather than assuming the two always match 1:1.
  const { count: leadsGenerated, error: leadsError } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("source", "Media Kit");
  if (leadsError) throw normalizeSupabaseError(leadsError);

  return {
    totalViews,
    approxUniqueVisitors: uniqueHashes.size,
    inquiries,
    leadsGenerated: leadsGenerated ?? 0,
  };
}

async function getMediaKitRecentActivity(workspaceId: string, mediaKitId: string, limit = 10): Promise<MediaKitRecentActivityItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("media_kit_view_events")
    .select("id, event_type, occurred_at")
    .eq("workspace_id", workspaceId)
    .eq("media_kit_id", mediaKitId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    eventType: row.event_type as MediaKitEventType,
    occurredAt: row.occurred_at as string,
  }));
}

export const supabaseMediaKitRepository: MediaKitRepository = {
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
