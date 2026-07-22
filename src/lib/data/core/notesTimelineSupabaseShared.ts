import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { EntityType } from "@/core/enums/entityType";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { mapNoteRow, mapTimelineActivityRow } from "@/lib/supabase/mappers";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { noteFormSchema, type NoteFormInput } from "@/modules/notes/schema";

function fieldErrorsFromZod(error: { issues: { path: PropertyKey[]; message: string }[] }): Partial<Record<string, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/**
 * The Supabase-mode counterpart to `lib/data/mock/notesTimelineShared.ts` —
 * every shipped module's `supabaseRepository.ts` (Leads, Clients, Events,
 * Contracts, Finance, Documents) currently reimplements this exact
 * fetch/create/toggle-pin logic locally rather than sharing it, because it
 * predates this file. This is the generalized version any future module
 * should call directly instead of writing a sixth copy — it is not wired
 * into the existing modules this phase (that would touch shipped,
 * already-verified code outside this phase's scope), only available for
 * what's built on Core going forward.
 *
 * Every function takes `supabase`/`workspaceId` explicitly rather than
 * resolving them itself, matching the existing per-module helpers exactly
 * — Core has no opinion on session handling or client lifecycle, callers
 * own that (see `documents/supabaseRepository.ts`'s `requireWorkspaceSession`
 * for the established pattern).
 */
export async function fetchNotesForOwnerSupabase(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapNoteRow);
}

export async function createNoteForOwnerSupabase(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
  actor: string,
  input: NoteFormInput,
): Promise<DataResult<Note>> {
  const parsed = noteFormSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const { data, error } = await supabase
    .from("notes")
    .insert({
      workspace_id: workspaceId,
      owner_type: ownerType,
      owner_id: ownerId,
      ...parsed.data,
      is_pinned: false,
      attachments: [],
      created_by: actor,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const note = mapNoteRow(data);
  await recordTimelineActivitySupabase(supabase, workspaceId, ownerType, ownerId, actor, "note_added", `Note added: "${note.title}"`);

  return ok(note);
}

/**
 * Owner-agnostic, matching the mock side's `togglePinNoteById` — the row
 * carries its own `owner_type`, so no caller-supplied owner type is needed
 * to guard the lookup. Returns `null` only when no note with this id
 * exists in this workspace at all.
 */
export async function togglePinNoteByIdSupabase(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  noteId: string,
  actor: string,
): Promise<DataResult<Note> | null> {
  const { data: noteRow, error: fetchError } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (fetchError) throw normalizeSupabaseError(fetchError);
  if (!noteRow) return null;

  const note = mapNoteRow(noteRow);
  const nextPinned = !note.is_pinned;
  const { data: updatedRow, error: updateError } = await supabase
    .from("notes")
    .update({ is_pinned: nextPinned })
    .eq("id", noteId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();
  if (updateError) throw normalizeSupabaseError(updateError);

  const updated = mapNoteRow(updatedRow);
  await recordTimelineActivitySupabase(
    supabase,
    workspaceId,
    note.owner_type,
    note.owner_id,
    actor,
    nextPinned ? "note_pinned" : "note_unpinned",
    `${nextPinned ? "Note pinned" : "Note unpinned"}: "${note.title}"`,
  );

  return ok(updated);
}

export async function fetchTimelineForOwnerSupabase(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
): Promise<TimelineActivity[]> {
  const { data, error } = await supabase
    .from("timeline_activities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("timestamp", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapTimelineActivityRow);
}

/**
 * `type` is intentionally typed as plain `string`, wider than the closed
 * `TimelineActivityType` union every existing module passes today — this is
 * what lets a future Core-registered activity type (see
 * `core/timeline/activityTypeRegistry.ts`) flow through without a Core-file
 * edit. The DB `timeline_activities_type_check` CHECK constraint is the
 * actual enforcement boundary; widening it for a new type is still a real
 * migration, deferred until a module needs that type persisted.
 */
export async function recordTimelineActivitySupabase(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
  actor: string,
  type: string,
  description: string,
  metadata?: Record<string, string | number | boolean | null>,
): Promise<void> {
  const { error } = await supabase.from("timeline_activities").insert({
    workspace_id: workspaceId,
    owner_type: ownerType,
    owner_id: ownerId,
    type,
    description,
    actor,
    ...(metadata ? { metadata } : {}),
  });
  if (error) throw normalizeSupabaseError(error);
}
