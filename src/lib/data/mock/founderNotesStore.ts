import type { NoteToFounder } from "@/types/founderNote";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/** In-memory only, no seed data — an employee's Note-for-Aline history starts empty. Mirrors every other mock store's read/write/reset convention. */
let notes: NoteToFounder[] = [];
let nextSeq = 1;

export function readFounderNotes(): NoteToFounder[] {
  return notes;
}

export function createMockFounderNote(authorId: string, body: string): NoteToFounder {
  const created: NoteToFounder = {
    id: `founder_note_${nextSeq++}`,
    workspace_id: CURRENT_WORKSPACE_ID,
    author_id: authorId,
    body,
    created_at: new Date().toISOString(),
  };
  notes = [created, ...notes];
  return created;
}

export function resetFounderNotesMockData(): void {
  notes = [];
  nextSeq = 1;
}
