import type { Database } from "@/types/database.types";
import type { NoteToFounder } from "@/types/founderNote";
import type { FounderNoteRepository } from "@/lib/data/founderNotes/repository";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";

type NoteRow = Database["public"]["Tables"]["notes_to_founder"]["Row"];

function mapNoteRow(row: NoteRow): NoteToFounder {
  return { id: row.id, workspace_id: row.workspace_id, author_id: row.author_id, body: row.body, created_at: row.created_at };
}

function requireContext(context: ServerRepositoryContext | undefined): ServerRepositoryContext {
  if (!context) throw new Error("Note for Aline requires a server-authenticated context.");
  return context;
}

export const supabaseFounderNoteRepository: FounderNoteRepository = {
  async getMyNotes(context) {
    const { supabase, session } = requireContext(context);
    const { data, error } = await supabase
      .from("notes_to_founder")
      .select("*")
      .eq("author_id", session.user.id)
      .order("created_at", { ascending: false });
    if (error) throw normalizeSupabaseError(error);
    return (data ?? []).map(mapNoteRow);
  },

  async createNote(body, context): Promise<DataResult<NoteToFounder>> {
    const trimmed = body.trim();
    if (trimmed.length === 0) return fail("Write something before sending.");
    const { supabase, session } = requireContext(context);
    const { data, error } = await supabase
      .from("notes_to_founder")
      .insert({ workspace_id: session.workspace.id, author_id: session.user.id, body: trimmed })
      .select("*")
      .single();
    if (error) return fail(normalizeSupabaseError(error).message);
    return ok(mapNoteRow(data));
  },
};
