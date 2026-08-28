import type { NoteToFounder } from "@/types/founderNote";
import type { DataResult } from "@/lib/data/result";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";

/**
 * "Note for Aline" persistence — the deliberate opposite privacy shape from
 * `WellnessRepository`: an employee's own notes are readable by them and by
 * the workspace owner/admin (see `notes_to_founder`'s RLS). `getMyNotes`
 * only ever returns the calling employee's own authored notes — there is
 * no "list every note the workspace has received" method here for the
 * employee side; a Founder-facing inbox, if built later, would be its own
 * separate method, not this one.
 */
export interface FounderNoteRepository {
  getMyNotes(context?: ServerRepositoryContext): Promise<NoteToFounder[]>;
  createNote(body: string, context?: ServerRepositoryContext): Promise<DataResult<NoteToFounder>>;
}
