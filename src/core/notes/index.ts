import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { EntityType } from "@/core/enums/entityType";
import type { DataResult } from "@/lib/data/result";
import type { NoteFormInput } from "@/modules/notes/schema";
import { getDataMode } from "@/lib/data/provider";
import { getNotesByOwner, createNoteForOwner, togglePinNoteById } from "@/lib/data/mock/notesTimelineShared";
import {
  fetchNotesForOwnerSupabase,
  createNoteForOwnerSupabase,
  togglePinNoteByIdSupabase,
} from "@/lib/data/core/notesTimelineSupabaseShared";

export type { Note, NoteAttachment } from "@/types/note";
export type { NoteFormInput } from "@/modules/notes/schema";

/**
 * Core's canonical Notes front door — the single import path a future
 * module (Inventory, Vendors, Bloom AI, or a new Core concept like
 * Comments) should use to let its entities own Notes, instead of writing
 * its own owner_type-guarded CRUD like every earlier module did. Any
 * `EntityType` can be an owner; adding a new one is a value in
 * `core/enums/entityType.ts`, never a change here.
 *
 * This wraps the already-shared mock helpers
 * (`lib/data/mock/notesTimelineShared.ts`) and the new Supabase helpers
 * (`lib/data/core/notesTimelineSupabaseShared.ts`) behind one mode-agnostic
 * surface, picked via the same `getDataMode()` every repository already
 * uses — so a caller never branches on data mode itself.
 *
 * Existing modules (Leads, Clients, Events, Contracts, Finance, Documents)
 * are NOT migrated onto this in this phase — their own repository methods
 * keep working exactly as before. This is additive infrastructure for what
 * gets built next.
 */
export interface CoreNotesService {
  getNotesForOwner(workspaceId: string, ownerType: EntityType, ownerId: string): ReturnType<typeof getNotesByOwner>;
  createNoteForOwner(
    workspaceId: string,
    ownerType: EntityType,
    ownerId: string,
    actor: string,
    input: NoteFormInput,
  ): Promise<DataResult<import("@/types/note").Note>>;
  togglePinNoteById(workspaceId: string, noteId: string, actor: string): ReturnType<typeof togglePinNoteById>;
}

function mockCoreNotesService(): CoreNotesService {
  return {
    getNotesForOwner: (workspaceId, ownerType, ownerId) => getNotesByOwner(workspaceId, ownerType, ownerId),
    createNoteForOwner: (workspaceId, ownerType, ownerId, _actor, input) =>
      createNoteForOwner(workspaceId, ownerType, ownerId, input),
    togglePinNoteById: (_workspaceId, noteId) => togglePinNoteById(noteId),
  };
}

function supabaseCoreNotesService(supabase: SupabaseClient<Database>): CoreNotesService {
  return {
    getNotesForOwner: (workspaceId, ownerType, ownerId) => fetchNotesForOwnerSupabase(supabase, workspaceId, ownerType, ownerId),
    createNoteForOwner: (workspaceId, ownerType, ownerId, actor, input) =>
      createNoteForOwnerSupabase(supabase, workspaceId, ownerType, ownerId, actor, input),
    togglePinNoteById: (workspaceId, noteId, actor) => togglePinNoteByIdSupabase(supabase, workspaceId, noteId, actor),
  };
}

/**
 * `supabaseClient` is required only in `supabase` data mode — mirrors
 * `createClient()` being a factory the caller owns (see
 * `lib/supabase/client.ts`), so Core never holds a client of its own.
 */
export function getCoreNotesService(supabaseClient?: SupabaseClient<Database>): CoreNotesService {
  if (getDataMode() === "supabase") {
    if (!supabaseClient) {
      throw new Error("getCoreNotesService requires a supabaseClient in 'supabase' data mode.");
    }
    return supabaseCoreNotesService(supabaseClient);
  }
  return mockCoreNotesService();
}
