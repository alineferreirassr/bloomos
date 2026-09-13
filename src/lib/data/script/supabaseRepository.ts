import type { ScriptItem } from "@/types/scriptItem";
import type { ScriptVersion } from "@/types/scriptVersion";
import type { ScriptBlock } from "@/types/scriptBlock";
import type { Database } from "@/types/database.types";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapScriptItemRow, mapScriptVersionRow, mapScriptBlockRow } from "@/lib/supabase/mappers";
import type {
  ScriptRepository,
  CreateScriptItemInput,
  UpdateScriptItemInput,
  ListScriptItemsFilters,
  CreateScriptVersionInput,
  CreateScriptBlockInput,
  UpdateScriptBlockInput,
} from "@/lib/data/script/repository";

type SupabaseClient = ReturnType<typeof createSupabaseClient>;

const SCRIPT_NOT_FOUND_ERROR = "This Script could not be found.";
const SCRIPT_BLOCK_NOT_FOUND_ERROR = "This Script block could not be found.";
const UNIQUE_VIOLATION = "23505";
/** Mirrors the DB's own `script_versions_one_draft_per_script` partial unique index. */
const DUPLICATE_DRAFT_ERROR = "This Script already has a draft version.";

function escapeIlikeWildcards(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

async function fetchScriptItemRow(supabase: SupabaseClient, id: string): Promise<ScriptItem | null> {
  const { data, error } = await supabase.from("script_items").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapScriptItemRow(data) : null;
}

async function createScriptItem(input: CreateScriptItemInput): Promise<DataResult<ScriptItem>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("script_items")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      title: input.title,
      source_idea_id: input.sourceIdeaId,
    })
    .select("*")
    .single();

  if (error) throw normalizeSupabaseError(error);
  return ok(mapScriptItemRow(data));
}

async function getScriptItemById(id: string): Promise<ScriptItem> {
  const supabase = createSupabaseClient();
  const item = await fetchScriptItemRow(supabase, id);
  if (!item) throw new Error(`Script item ${id} was not found`);
  return item;
}

async function listScriptItems(workspaceId: string, filters: ListScriptItemsFilters = {}): Promise<ScriptItem[]> {
  const { archived = "active", search, limit = 50, offset = 0 } = filters;
  const supabase = createSupabaseClient();

  let query = supabase.from("script_items").select("*").eq("workspace_id", workspaceId);
  if (archived === "active") query = query.eq("status", "active");
  else if (archived === "archived") query = query.eq("status", "archived");
  const trimmedSearch = search?.trim();
  if (trimmedSearch) query = query.ilike("title", `%${escapeIlikeWildcards(trimmedSearch)}%`);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapScriptItemRow);
}

async function updateScriptItem(id: string, input: UpdateScriptItemInput): Promise<DataResult<ScriptItem>> {
  const supabase = createSupabaseClient();
  const patch: Database["public"]["Tables"]["script_items"]["Update"] = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.sourceIdeaId !== undefined) patch.source_idea_id = input.sourceIdeaId;

  const { data, error } = await supabase.from("script_items").update(patch).eq("id", id).select("*").single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return fail(SCRIPT_NOT_FOUND_ERROR);
    throw normalizeSupabaseError(error);
  }

  return ok(mapScriptItemRow(data));
}

async function archiveScriptItem(id: string): Promise<DataResult<ScriptItem>> {
  const supabase = createSupabaseClient();
  const existing = await fetchScriptItemRow(supabase, id);
  if (!existing) return fail(SCRIPT_NOT_FOUND_ERROR);
  if (existing.status === "archived") return ok(existing);

  const { data, error } = await supabase
    .from("script_items")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapScriptItemRow(data));
}

async function unarchiveScriptItem(id: string): Promise<DataResult<ScriptItem>> {
  const supabase = createSupabaseClient();
  const existing = await fetchScriptItemRow(supabase, id);
  if (!existing) return fail(SCRIPT_NOT_FOUND_ERROR);
  if (existing.status === "active") return ok(existing);

  const { data, error } = await supabase.from("script_items").update({ status: "active", archived_at: null }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapScriptItemRow(data));
}

async function fetchScriptVersionRow(supabase: SupabaseClient, id: string): Promise<ScriptVersion | null> {
  const { data, error } = await supabase.from("script_versions").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapScriptVersionRow(data) : null;
}

async function createScriptVersion(input: CreateScriptVersionInput): Promise<DataResult<ScriptVersion>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("script_versions")
    .insert({
      script_id: input.scriptId,
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) return fail(DUPLICATE_DRAFT_ERROR);
    throw normalizeSupabaseError(error);
  }

  return ok(mapScriptVersionRow(data));
}

async function getScriptVersionById(id: string): Promise<ScriptVersion> {
  const supabase = createSupabaseClient();
  const version = await fetchScriptVersionRow(supabase, id);
  if (!version) throw new Error(`Script version ${id} was not found`);
  return version;
}

async function listScriptVersions(scriptId: string): Promise<ScriptVersion[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("script_versions")
    .select("*")
    .eq("script_id", scriptId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapScriptVersionRow);
}

async function createScriptBlock(input: CreateScriptBlockInput): Promise<DataResult<ScriptBlock>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("script_blocks")
    .insert({
      script_version_id: input.scriptVersionId,
      workspace_id: input.workspaceId,
      content: input.content,
      sort_order: input.sortOrder,
    })
    .select("*")
    .single();

  if (error) throw normalizeSupabaseError(error);
  return ok(mapScriptBlockRow(data));
}

async function listScriptBlocks(scriptVersionId: string): Promise<ScriptBlock[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("script_blocks")
    .select("*")
    .eq("script_version_id", scriptVersionId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapScriptBlockRow);
}

async function updateScriptBlock(id: string, input: UpdateScriptBlockInput): Promise<DataResult<ScriptBlock>> {
  const supabase = createSupabaseClient();
  const patch: Database["public"]["Tables"]["script_blocks"]["Update"] = {};
  if (input.content !== undefined) patch.content = input.content;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const { data, error } = await supabase.from("script_blocks").update(patch).eq("id", id).select("*").single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return fail(SCRIPT_BLOCK_NOT_FOUND_ERROR);
    throw normalizeSupabaseError(error);
  }

  return ok(mapScriptBlockRow(data));
}

export const supabaseScriptRepository: ScriptRepository = {
  createScriptItem,
  getScriptItemById,
  listScriptItems,
  updateScriptItem,
  archiveScriptItem,
  unarchiveScriptItem,
  createScriptVersion,
  getScriptVersionById,
  listScriptVersions,
  createScriptBlock,
  listScriptBlocks,
  updateScriptBlock,
};
