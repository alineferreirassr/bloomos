import { createClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type {
  MediaKit,
  MediaKitAnalyticsSummary,
  MediaKitBrandInput,
  MediaKitContentStatus,
  MediaKitEventType,
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

interface MediaKitPortfolioItemRow {
  id: string;
  workspace_id: string;
  media_kit_id: string;
  event_id: string | null;
  title: string;
  category: string | null;
  location_label: string | null;
  event_year: number | null;
  short_description: string | null;
  cover_media_asset_id: string | null;
  is_featured: boolean;
  is_included: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

function mapMediaKitPortfolioItemRow(row: MediaKitPortfolioItemRow): MediaKitPortfolioItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    media_kit_id: row.media_kit_id,
    event_id: row.event_id,
    title: row.title,
    category: row.category,
    location_label: row.location_label,
    event_year: row.event_year,
    short_description: row.short_description,
    cover_media_asset_id: row.cover_media_asset_id,
    is_featured: row.is_featured,
    is_included: row.is_included,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

interface MediaKitGalleryItemRow {
  id: string;
  workspace_id: string;
  media_kit_id: string;
  portfolio_item_id: string | null;
  media_asset_id: string;
  caption: string | null;
  is_cover: boolean;
  is_included: boolean;
  sort_order: number;
  created_at: string;
  archived_at: string | null;
}

function mapMediaKitGalleryItemRow(row: MediaKitGalleryItemRow): MediaKitGalleryItem {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    media_kit_id: row.media_kit_id,
    portfolio_item_id: row.portfolio_item_id,
    media_asset_id: row.media_asset_id,
    caption: row.caption,
    is_cover: row.is_cover,
    is_included: row.is_included,
    sort_order: row.sort_order,
    created_at: row.created_at,
    archived_at: row.archived_at,
  };
}

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

// ── MEDIAKIT-04 — Portfolio ────────────────────────────────────────────

async function listMediaKitPortfolioItems(workspaceId: string, mediaKitId: string): Promise<MediaKitPortfolioItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("media_kit_portfolio_items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("media_kit_id", mediaKitId)
    .is("archived_at", null);
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map((row) => mapMediaKitPortfolioItemRow(row as MediaKitPortfolioItemRow));
}

async function createMediaKitPortfolioItem(workspaceId: string, mediaKitId: string, input: MediaKitPortfolioItemInput): Promise<DataResult<MediaKitPortfolioItem>> {
  const supabase = await createClient();

  const { data: maxSortRow, error: maxSortError } = await supabase
    .from("media_kit_portfolio_items")
    .select("sort_order")
    .eq("media_kit_id", mediaKitId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxSortError) throw normalizeSupabaseError(maxSortError);
  const nextSortOrder = maxSortRow ? (maxSortRow as { sort_order: number }).sort_order + 1 : 0;

  const { data: created, error: insertError } = await supabase
    .from("media_kit_portfolio_items")
    .insert({
      workspace_id: workspaceId,
      media_kit_id: mediaKitId,
      event_id: input.event_id,
      title: input.title,
      category: input.category,
      location_label: input.location_label,
      event_year: input.event_year,
      short_description: input.short_description,
      cover_media_asset_id: input.cover_media_asset_id,
      is_featured: input.is_featured,
      is_included: input.is_included,
      sort_order: nextSortOrder,
    })
    .select("*")
    .single();
  if (insertError) throw normalizeSupabaseError(insertError);
  return ok(mapMediaKitPortfolioItemRow(created as MediaKitPortfolioItemRow));
}

async function updateMediaKitPortfolioItem(workspaceId: string, itemId: string, input: MediaKitPortfolioItemInput): Promise<DataResult<MediaKitPortfolioItem>> {
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("media_kit_portfolio_items")
    .update({
      event_id: input.event_id,
      title: input.title,
      category: input.category,
      location_label: input.location_label,
      event_year: input.event_year,
      short_description: input.short_description,
      cover_media_asset_id: input.cover_media_asset_id,
      is_featured: input.is_featured,
      is_included: input.is_included,
    })
    .eq("id", itemId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!updated) return fail("This portfolio item could not be found.");
  return ok(mapMediaKitPortfolioItemRow(updated as MediaKitPortfolioItemRow));
}

/** `media_kit_portfolio_items` has no delete RLS policy — `archived_at` is the only removal path. */
async function archiveMediaKitPortfolioItem(workspaceId: string, itemId: string): Promise<DataResult<MediaKitPortfolioItem>> {
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("media_kit_portfolio_items")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!updated) return fail("This portfolio item could not be found.");
  return ok(mapMediaKitPortfolioItemRow(updated as MediaKitPortfolioItemRow));
}

async function reorderMediaKitPortfolioItems(workspaceId: string, mediaKitId: string, orderedItemIds: string[]): Promise<DataResult<MediaKitPortfolioItem[]>> {
  const supabase = await createClient();

  const updated = await Promise.all(
    orderedItemIds.map(async (itemId, position) => {
      const { data, error } = await supabase
        .from("media_kit_portfolio_items")
        .update({ sort_order: position })
        .eq("id", itemId)
        .eq("workspace_id", workspaceId)
        .eq("media_kit_id", mediaKitId)
        .select("*")
        .maybeSingle();
      if (error) throw normalizeSupabaseError(error);
      return data ? mapMediaKitPortfolioItemRow(data as MediaKitPortfolioItemRow) : null;
    }),
  );

  const rows = updated.filter((row): row is MediaKitPortfolioItem => row !== null);
  return ok(rows.sort((a, b) => a.sort_order - b.sort_order));
}

// ── MEDIAKIT-04 — Gallery ──────────────────────────────────────────────

async function listMediaKitGalleryItems(workspaceId: string, mediaKitId: string, portfolioItemId: string | null): Promise<MediaKitGalleryItem[]> {
  const supabase = await createClient();

  let query = supabase.from("media_kit_gallery_items").select("*").eq("workspace_id", workspaceId).eq("media_kit_id", mediaKitId).is("archived_at", null);
  query = portfolioItemId === null ? query.is("portfolio_item_id", null) : query.eq("portfolio_item_id", portfolioItemId);
  const { data, error } = await query;
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map((row) => mapMediaKitGalleryItemRow(row as MediaKitGalleryItemRow));
}

async function addMediaKitGalleryItem(workspaceId: string, mediaKitId: string, portfolioItemId: string | null, mediaAssetId: string): Promise<DataResult<MediaKitGalleryItem>> {
  const supabase = await createClient();

  let maxSortQuery = supabase.from("media_kit_gallery_items").select("sort_order").eq("media_kit_id", mediaKitId);
  maxSortQuery = portfolioItemId === null ? maxSortQuery.is("portfolio_item_id", null) : maxSortQuery.eq("portfolio_item_id", portfolioItemId);
  const { data: maxSortRow, error: maxSortError } = await maxSortQuery.order("sort_order", { ascending: false }).limit(1).maybeSingle();
  if (maxSortError) throw normalizeSupabaseError(maxSortError);
  const nextSortOrder = maxSortRow ? (maxSortRow as { sort_order: number }).sort_order + 1 : 0;

  const { data: created, error: insertError } = await supabase
    .from("media_kit_gallery_items")
    .insert({
      workspace_id: workspaceId,
      media_kit_id: mediaKitId,
      portfolio_item_id: portfolioItemId,
      media_asset_id: mediaAssetId,
      sort_order: nextSortOrder,
    })
    .select("*")
    .single();
  if (insertError) throw normalizeSupabaseError(insertError);
  return ok(mapMediaKitGalleryItemRow(created as MediaKitGalleryItemRow));
}

/** Setting `is_cover: true` clears any other cover within the same (media_kit_id, portfolio_item_id) scope first — at most one cover per scope. Not a DB constraint (none exists), enforced here at the application layer. */
async function updateMediaKitGalleryItem(workspaceId: string, itemId: string, input: MediaKitGalleryItemInput): Promise<DataResult<MediaKitGalleryItem>> {
  const supabase = await createClient();

  const { data: target, error: targetError } = await supabase
    .from("media_kit_gallery_items")
    .select("media_kit_id, portfolio_item_id")
    .eq("id", itemId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (targetError) throw normalizeSupabaseError(targetError);
  if (!target) return fail("This gallery image could not be found.");

  if (input.is_cover) {
    const targetRow = target as { media_kit_id: string; portfolio_item_id: string | null };
    let clearQuery = supabase
      .from("media_kit_gallery_items")
      .update({ is_cover: false })
      .eq("media_kit_id", targetRow.media_kit_id)
      .eq("is_cover", true)
      .neq("id", itemId);
    clearQuery = targetRow.portfolio_item_id === null ? clearQuery.is("portfolio_item_id", null) : clearQuery.eq("portfolio_item_id", targetRow.portfolio_item_id);
    const { error: clearError } = await clearQuery;
    if (clearError) throw normalizeSupabaseError(clearError);
  }

  const { data: updated, error } = await supabase
    .from("media_kit_gallery_items")
    .update({ caption: input.caption, is_cover: input.is_cover, is_included: input.is_included })
    .eq("id", itemId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!updated) return fail("This gallery image could not be found.");
  return ok(mapMediaKitGalleryItemRow(updated as MediaKitGalleryItemRow));
}

/** `media_kit_gallery_items` has no delete RLS policy either — `archived_at` is the only removal path. */
async function archiveMediaKitGalleryItem(workspaceId: string, itemId: string): Promise<DataResult<MediaKitGalleryItem>> {
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("media_kit_gallery_items")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!updated) return fail("This gallery image could not be found.");
  return ok(mapMediaKitGalleryItemRow(updated as MediaKitGalleryItemRow));
}

async function reorderMediaKitGalleryItems(
  workspaceId: string,
  mediaKitId: string,
  portfolioItemId: string | null,
  orderedItemIds: string[],
): Promise<DataResult<MediaKitGalleryItem[]>> {
  const supabase = await createClient();

  const updated = await Promise.all(
    orderedItemIds.map(async (itemId, position) => {
      let query = supabase
        .from("media_kit_gallery_items")
        .update({ sort_order: position })
        .eq("id", itemId)
        .eq("workspace_id", workspaceId)
        .eq("media_kit_id", mediaKitId);
      query = portfolioItemId === null ? query.is("portfolio_item_id", null) : query.eq("portfolio_item_id", portfolioItemId);
      const { data, error } = await query.select("*").maybeSingle();
      if (error) throw normalizeSupabaseError(error);
      return data ? mapMediaKitGalleryItemRow(data as MediaKitGalleryItemRow) : null;
    }),
  );

  const rows = updated.filter((row): row is MediaKitGalleryItem => row !== null);
  return ok(rows.sort((a, b) => a.sort_order - b.sort_order));
}

// ── MEDIAKIT-04 — Publish ──────────────────────────────────────────────

/** Wires the frozen `publish_media_kit(uuid)` RPC. It re-derives the workspace/authorization itself (`security definer`, row-locks the media_kits row), so this is a thin pass-through plus a re-read of the refreshed row. */
async function publishMediaKit(workspaceId: string, mediaKitId: string): Promise<DataResult<MediaKit>> {
  const supabase = await createClient();

  const { error: rpcError } = await supabase.rpc("publish_media_kit", { p_media_kit_id: mediaKitId });
  if (rpcError) {
    if (rpcError.message.includes("Not authorized") || rpcError.message.includes("not found")) return fail("This Media Kit could not be published.");
    throw normalizeSupabaseError(rpcError);
  }

  const { data: refreshed, error: selectError } = await supabase
    .from("media_kits")
    .select("*")
    .eq("id", mediaKitId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (selectError) throw normalizeSupabaseError(selectError);
  if (!refreshed) return fail("This Media Kit could not be found.");
  return ok(mapMediaKitRow(refreshed as MediaKitRow));
}

async function countIncludedRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "media_kit_services" | "media_kit_portfolio_items" | "media_kit_gallery_items" | "media_kit_partners" | "media_kit_press_features",
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

async function countTotalRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "media_kit_portfolio_items" | "media_kit_gallery_items",
  mediaKitId: string,
): Promise<number> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("media_kit_id", mediaKitId).is("archived_at", null);
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

  const [includedServicesCount, includedPortfolioCount, totalPortfolioCount, includedGalleryCount, totalGalleryCount, partnersCount, pressCount] = await Promise.all([
    countIncludedRows(supabase, "media_kit_services", mediaKitId),
    countIncludedRows(supabase, "media_kit_portfolio_items", mediaKitId),
    countTotalRows(supabase, "media_kit_portfolio_items", mediaKitId),
    countIncludedRows(supabase, "media_kit_gallery_items", mediaKitId),
    countTotalRows(supabase, "media_kit_gallery_items", mediaKitId),
    countIncludedRows(supabase, "media_kit_partners", mediaKitId),
    countIncludedRows(supabase, "media_kit_press_features", mediaKitId),
  ]);

  const services = (totalServiceCurations ?? 0) === 0 ? "not_started" : includedServicesCount > 0 ? "ready" : "in_progress";
  const portfolio = totalPortfolioCount === 0 ? "not_started" : includedPortfolioCount > 0 ? "ready" : "in_progress";
  const gallery = totalGalleryCount === 0 ? "not_started" : includedGalleryCount > 0 ? "ready" : "in_progress";

  const { count: testimonialsCount, error: testimonialsError } = await supabase
    .from("media_kit_testimonials")
    .select("id", { count: "exact", head: true })
    .eq("media_kit_id", mediaKitId)
    .eq("is_included", true)
    .eq("is_approved", true)
    .is("archived_at", null);
  if (testimonialsError) throw normalizeSupabaseError(testimonialsError);

  return {
    brand,
    services,
    portfolio,
    partners: partnersCount > 0 ? "ready" : "not_started",
    testimonials: (testimonialsCount ?? 0) > 0 ? "ready" : "not_started",
    press: pressCount > 0 ? "ready" : "not_started",
    gallery,
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
