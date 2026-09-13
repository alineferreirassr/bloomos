import type { IdeaItem } from "@/types/ideaItem";
import type { Database } from "@/types/database.types";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapIdeaItemRow } from "@/lib/supabase/mappers";
import type {
  IdeaItemsRepository,
  CreateIdeaItemInput,
  UpdateIdeaItemInput,
  ListIdeaItemsFilters,
} from "@/lib/data/idea/repository";

type SupabaseClient = ReturnType<typeof createSupabaseClient>;

const NOT_FOUND_ERROR = "This Idea could not be found.";

/**
 * Escapes Postgres ILIKE wildcard characters (`%`, `_`) and the escape
 * character itself (`\`) so a search term is always matched as a literal
 * substring, never as a pattern — mirrors `escapeIlikeWildcards` in
 * `inspiration/supabaseRepository.ts` exactly. Deliberately searches only
 * `title` via a single `.ilike()` call, matching that same established
 * precedent.
 */
function escapeIlikeWildcards(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

async function fetchIdeaItemRow(supabase: SupabaseClient, id: string): Promise<IdeaItem | null> {
  const { data, error } = await supabase.from("idea_items").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapIdeaItemRow(data) : null;
}

async function createIdeaItem(input: CreateIdeaItemInput): Promise<DataResult<IdeaItem>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("idea_items")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      title: input.title,
      description: input.description,
      source_inspiration_id: input.sourceInspirationId,
      content_format: input.contentFormat,
      hook: input.hook,
      cta: input.cta,
      audience: input.audience,
      notes: input.notes,
      media_asset_id: input.mediaAssetId,
      priority: input.priority,
    })
    .select("*")
    .single();

  if (error) throw normalizeSupabaseError(error);
  return ok(mapIdeaItemRow(data));
}

async function getIdeaItemById(id: string): Promise<IdeaItem> {
  const supabase = createSupabaseClient();
  const item = await fetchIdeaItemRow(supabase, id);
  if (!item) throw new Error(`Idea item ${id} was not found`);
  return item;
}

async function listIdeaItems(workspaceId: string, filters: ListIdeaItemsFilters = {}): Promise<IdeaItem[]> {
  const { archived = "active", search, limit = 50, offset = 0 } = filters;
  const supabase = createSupabaseClient();

  let query = supabase.from("idea_items").select("*").eq("workspace_id", workspaceId);
  if (archived === "active") query = query.eq("status", "active");
  else if (archived === "archived") query = query.eq("status", "archived");
  const trimmedSearch = search?.trim();
  if (trimmedSearch) query = query.ilike("title", `%${escapeIlikeWildcards(trimmedSearch)}%`);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapIdeaItemRow);
}

async function updateIdeaItem(id: string, input: UpdateIdeaItemInput): Promise<DataResult<IdeaItem>> {
  const supabase = createSupabaseClient();
  const patch: Database["public"]["Tables"]["idea_items"]["Update"] = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.sourceInspirationId !== undefined) patch.source_inspiration_id = input.sourceInspirationId;
  if (input.contentFormat !== undefined) patch.content_format = input.contentFormat;
  if (input.hook !== undefined) patch.hook = input.hook;
  if (input.cta !== undefined) patch.cta = input.cta;
  if (input.audience !== undefined) patch.audience = input.audience;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.mediaAssetId !== undefined) patch.media_asset_id = input.mediaAssetId;
  if (input.priority !== undefined) patch.priority = input.priority;

  const { data, error } = await supabase.from("idea_items").update(patch).eq("id", id).select("*").single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return fail(NOT_FOUND_ERROR);
    throw normalizeSupabaseError(error);
  }

  return ok(mapIdeaItemRow(data));
}

async function archiveIdeaItem(id: string): Promise<DataResult<IdeaItem>> {
  const supabase = createSupabaseClient();
  const existing = await fetchIdeaItemRow(supabase, id);
  if (!existing) return fail(NOT_FOUND_ERROR);
  if (existing.status === "archived") return ok(existing);

  const { data, error } = await supabase
    .from("idea_items")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapIdeaItemRow(data));
}

async function unarchiveIdeaItem(id: string): Promise<DataResult<IdeaItem>> {
  const supabase = createSupabaseClient();
  const existing = await fetchIdeaItemRow(supabase, id);
  if (!existing) return fail(NOT_FOUND_ERROR);
  if (existing.status === "active") return ok(existing);

  const { data, error } = await supabase.from("idea_items").update({ status: "active", archived_at: null }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapIdeaItemRow(data));
}

export const supabaseIdeaItemsRepository: IdeaItemsRepository = {
  createIdeaItem,
  getIdeaItemById,
  listIdeaItems,
  updateIdeaItem,
  archiveIdeaItem,
  unarchiveIdeaItem,
};
