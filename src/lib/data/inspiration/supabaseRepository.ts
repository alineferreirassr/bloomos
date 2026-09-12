import type { InspirationItem } from "@/types/inspirationItem";
import type { Database } from "@/types/database.types";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapInspirationItemRow } from "@/lib/supabase/mappers";
import type {
  InspirationItemsRepository,
  CreateInspirationItemInput,
  UpdateInspirationItemInput,
  ListInspirationItemsFilters,
} from "@/lib/data/inspiration/repository";

type SupabaseClient = ReturnType<typeof createSupabaseClient>;

const NOT_FOUND_ERROR = "This Inspiration item could not be found.";
const UNIQUE_VIOLATION = "23505";
/** Mirrors the migration's two partial unique indexes — one message covers both, matching vendors/purchases/finance/contracts/inventory's own established single-message-per-table convention rather than inventing constraint-name parsing. */
const DUPLICATE_ERROR = "This has already been saved to your Inspiration library.";

/**
 * Escapes Postgres ILIKE wildcard characters (`%`, `_`) and the escape
 * character itself (`\`) so a search term is always matched as a literal
 * substring, never as a pattern — Phase 19's "search plain text only, no
 * arbitrary filter syntax." Deliberately searches only `title` via a single
 * `.ilike()` call (a plain bound query parameter) rather than `.or()`
 * across multiple columns — this codebase has no existing `.or()`
 * precedent, and a raw search term embedded in an `.or()` filter *string*
 * (where comma/parens are meaningful DSL syntax, not just SQL wildcards)
 * would need a materially different, unverified escaping scheme. The
 * single-column `.ilike()` form has no such risk.
 */
function escapeIlikeWildcards(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

async function fetchInspirationItemRow(supabase: SupabaseClient, id: string): Promise<InspirationItem | null> {
  const { data, error } = await supabase.from("inspiration_items").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapInspirationItemRow(data) : null;
}

async function createInspirationItem(input: CreateInspirationItemInput): Promise<DataResult<InspirationItem>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("inspiration_items")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      title: input.title,
      source_type: input.sourceType,
      source_url: input.sourceUrl,
      normalized_source_url: input.normalizedSourceUrl,
      creator_name: input.creatorName,
      creator_handle: input.creatorHandle,
      platform_content_id: input.platformContentId,
      content_format: input.contentFormat,
      hook: input.hook,
      cta: input.cta,
      why_it_works: input.whyItWorks,
      notes: input.notes,
      duration_seconds: input.durationSeconds,
      published_at: input.publishedAt,
      media_asset_id: input.mediaAssetId,
    })
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) return fail(DUPLICATE_ERROR);
    throw normalizeSupabaseError(error);
  }

  return ok(mapInspirationItemRow(data));
}

async function getInspirationItemById(id: string): Promise<InspirationItem> {
  const supabase = createSupabaseClient();
  const item = await fetchInspirationItemRow(supabase, id);
  if (!item) throw new Error(`Inspiration item ${id} was not found`);
  return item;
}

async function listInspirationItems(workspaceId: string, filters: ListInspirationItemsFilters = {}): Promise<InspirationItem[]> {
  const { archived = "active", sourceType, contentFormat, search, limit = 50, offset = 0 } = filters;
  const supabase = createSupabaseClient();

  let query = supabase.from("inspiration_items").select("*").eq("workspace_id", workspaceId);
  if (archived === "active") query = query.is("archived_at", null);
  else if (archived === "archived") query = query.not("archived_at", "is", null);
  if (sourceType) query = query.eq("source_type", sourceType);
  if (contentFormat) query = query.eq("content_format", contentFormat);
  const trimmedSearch = search?.trim();
  if (trimmedSearch) query = query.ilike("title", `%${escapeIlikeWildcards(trimmedSearch)}%`);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapInspirationItemRow);
}

async function updateInspirationItem(id: string, input: UpdateInspirationItemInput): Promise<DataResult<InspirationItem>> {
  const supabase = createSupabaseClient();
  const patch: Database["public"]["Tables"]["inspiration_items"]["Update"] = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.sourceType !== undefined) patch.source_type = input.sourceType;
  if (input.sourceUrl !== undefined) patch.source_url = input.sourceUrl;
  if (input.normalizedSourceUrl !== undefined) patch.normalized_source_url = input.normalizedSourceUrl;
  if (input.creatorName !== undefined) patch.creator_name = input.creatorName;
  if (input.creatorHandle !== undefined) patch.creator_handle = input.creatorHandle;
  if (input.platformContentId !== undefined) patch.platform_content_id = input.platformContentId;
  if (input.contentFormat !== undefined) patch.content_format = input.contentFormat;
  if (input.hook !== undefined) patch.hook = input.hook;
  if (input.cta !== undefined) patch.cta = input.cta;
  if (input.whyItWorks !== undefined) patch.why_it_works = input.whyItWorks;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.durationSeconds !== undefined) patch.duration_seconds = input.durationSeconds;
  if (input.publishedAt !== undefined) patch.published_at = input.publishedAt;
  if (input.mediaAssetId !== undefined) patch.media_asset_id = input.mediaAssetId;

  const { data, error } = await supabase.from("inspiration_items").update(patch).eq("id", id).select("*").single();

  if (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) return fail(DUPLICATE_ERROR);
    if ((error as { code?: string }).code === "PGRST116") return fail(NOT_FOUND_ERROR);
    throw normalizeSupabaseError(error);
  }

  return ok(mapInspirationItemRow(data));
}

async function archiveInspirationItem(id: string): Promise<DataResult<InspirationItem>> {
  const supabase = createSupabaseClient();
  const existing = await fetchInspirationItemRow(supabase, id);
  if (!existing) return fail(NOT_FOUND_ERROR);
  if (existing.archived_at !== null) return ok(existing);

  const { data, error } = await supabase.from("inspiration_items").update({ archived_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapInspirationItemRow(data));
}

async function unarchiveInspirationItem(id: string): Promise<DataResult<InspirationItem>> {
  const supabase = createSupabaseClient();
  const existing = await fetchInspirationItemRow(supabase, id);
  if (!existing) return fail(NOT_FOUND_ERROR);
  if (existing.archived_at === null) return ok(existing);

  const { data, error } = await supabase.from("inspiration_items").update({ archived_at: null }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapInspirationItemRow(data));
}

export const supabaseInspirationItemsRepository: InspirationItemsRepository = {
  createInspirationItem,
  getInspirationItemById,
  listInspirationItems,
  updateInspirationItem,
  archiveInspirationItem,
  unarchiveInspirationItem,
};
