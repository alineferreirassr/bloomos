import type { CarouselItem } from "@/types/carouselItem";
import type { CarouselSlide } from "@/types/carouselSlide";
import type { Database } from "@/types/database.types";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapCarouselItemRow, mapCarouselSlideRow } from "@/lib/supabase/mappers";
import type {
  CarouselRepository,
  CreateCarouselItemInput,
  UpdateCarouselItemInput,
  ListCarouselItemsFilters,
  CreateCarouselSlideInput,
  UpdateCarouselSlideInput,
} from "@/lib/data/carousel/repository";

type SupabaseClient = ReturnType<typeof createSupabaseClient>;

const CAROUSEL_NOT_FOUND_ERROR = "This Carousel could not be found.";
const CAROUSEL_SLIDE_NOT_FOUND_ERROR = "This Carousel slide could not be found.";

function escapeIlikeWildcards(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

async function fetchCarouselItemRow(supabase: SupabaseClient, id: string): Promise<CarouselItem | null> {
  const { data, error } = await supabase.from("carousel_items").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapCarouselItemRow(data) : null;
}

async function createCarouselItem(input: CreateCarouselItemInput): Promise<DataResult<CarouselItem>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("carousel_items")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      title: input.title,
      source_idea_id: input.sourceIdeaId,
    })
    .select("*")
    .single();

  if (error) throw normalizeSupabaseError(error);
  return ok(mapCarouselItemRow(data));
}

async function getCarouselItemById(id: string): Promise<CarouselItem> {
  const supabase = createSupabaseClient();
  const item = await fetchCarouselItemRow(supabase, id);
  if (!item) throw new Error(`Carousel item ${id} was not found`);
  return item;
}

async function listCarouselItems(workspaceId: string, filters: ListCarouselItemsFilters = {}): Promise<CarouselItem[]> {
  const { archived = "active", search, limit = 50, offset = 0 } = filters;
  const supabase = createSupabaseClient();

  let query = supabase.from("carousel_items").select("*").eq("workspace_id", workspaceId);
  if (archived === "active") query = query.eq("status", "active");
  else if (archived === "archived") query = query.eq("status", "archived");
  const trimmedSearch = search?.trim();
  if (trimmedSearch) query = query.ilike("title", `%${escapeIlikeWildcards(trimmedSearch)}%`);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapCarouselItemRow);
}

async function updateCarouselItem(id: string, input: UpdateCarouselItemInput): Promise<DataResult<CarouselItem>> {
  const supabase = createSupabaseClient();
  const patch: Database["public"]["Tables"]["carousel_items"]["Update"] = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.sourceIdeaId !== undefined) patch.source_idea_id = input.sourceIdeaId;

  const { data, error } = await supabase.from("carousel_items").update(patch).eq("id", id).select("*").single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return fail(CAROUSEL_NOT_FOUND_ERROR);
    throw normalizeSupabaseError(error);
  }

  return ok(mapCarouselItemRow(data));
}

async function archiveCarouselItem(id: string): Promise<DataResult<CarouselItem>> {
  const supabase = createSupabaseClient();
  const existing = await fetchCarouselItemRow(supabase, id);
  if (!existing) return fail(CAROUSEL_NOT_FOUND_ERROR);
  if (existing.status === "archived") return ok(existing);

  const { data, error } = await supabase
    .from("carousel_items")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapCarouselItemRow(data));
}

async function unarchiveCarouselItem(id: string): Promise<DataResult<CarouselItem>> {
  const supabase = createSupabaseClient();
  const existing = await fetchCarouselItemRow(supabase, id);
  if (!existing) return fail(CAROUSEL_NOT_FOUND_ERROR);
  if (existing.status === "active") return ok(existing);

  const { data, error } = await supabase.from("carousel_items").update({ status: "active", archived_at: null }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapCarouselItemRow(data));
}

async function createCarouselSlide(input: CreateCarouselSlideInput): Promise<DataResult<CarouselSlide>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("carousel_slides")
    .insert({
      carousel_id: input.carouselId,
      workspace_id: input.workspaceId,
      content: input.content,
      sort_order: input.sortOrder,
      media_asset_id: input.mediaAssetId,
    })
    .select("*")
    .single();

  if (error) throw normalizeSupabaseError(error);
  return ok(mapCarouselSlideRow(data));
}

async function listCarouselSlides(carouselId: string): Promise<CarouselSlide[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("carousel_slides")
    .select("*")
    .eq("carousel_id", carouselId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapCarouselSlideRow);
}

async function updateCarouselSlide(id: string, input: UpdateCarouselSlideInput): Promise<DataResult<CarouselSlide>> {
  const supabase = createSupabaseClient();
  const patch: Database["public"]["Tables"]["carousel_slides"]["Update"] = {};
  if (input.content !== undefined) patch.content = input.content;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.mediaAssetId !== undefined) patch.media_asset_id = input.mediaAssetId;

  const { data, error } = await supabase.from("carousel_slides").update(patch).eq("id", id).select("*").single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return fail(CAROUSEL_SLIDE_NOT_FOUND_ERROR);
    throw normalizeSupabaseError(error);
  }

  return ok(mapCarouselSlideRow(data));
}

/**
 * The one real physical deletion in Carousel Studio, authorized
 * specifically for `carousel_slides` (see this checkpoint's own migration).
 * `.select("id")` on the delete makes a no-matching-row delete
 * distinguishable from a real one — Supabase's delete otherwise returns no
 * error and an empty `data` array either way, so without this a caller
 * deleting an already-gone/foreign-workspace slide (RLS silently excludes
 * it, never a permission error) would see a false success. Mirrors
 * `removeScriptBlock`'s own exact shape.
 */
async function removeCarouselSlide(id: string): Promise<DataResult<null>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("carousel_slides").delete().eq("id", id).select("id");
  if (error) throw normalizeSupabaseError(error);
  if (!data || data.length === 0) return fail(CAROUSEL_SLIDE_NOT_FOUND_ERROR);
  return ok(null);
}

export const supabaseCarouselRepository: CarouselRepository = {
  createCarouselItem,
  getCarouselItemById,
  listCarouselItems,
  updateCarouselItem,
  archiveCarouselItem,
  unarchiveCarouselItem,
  createCarouselSlide,
  listCarouselSlides,
  updateCarouselSlide,
  removeCarouselSlide,
};
