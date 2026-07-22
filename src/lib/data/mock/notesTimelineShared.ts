import type { Note } from "@/types/note";
import type { EntityType } from "@/core/enums/entityType";
import { CURRENT_ACTOR } from "@/core/constants/actor";
import { generateId, nowIso, delay } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readNotes, writeNotes } from "@/lib/data/mock/notesStore";
import { readActivities, recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import type { TimelineActivity } from "@/types/timelineActivity";
import { noteFormSchema, type NoteFormInput } from "@/modules/notes/schema";

function fieldErrorsFromZod(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Partial<Record<string, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Generic mock Notes/Timeline read/write helpers shared by every owner type
 * (Leads, Clients, and any future owner) — moved out of lib/data/index.ts so
 * the Leads mock repository (lib/data/leads/mockRepository.ts) and the
 * remaining Client/Contract/etc. Notes functions in lib/data/index.ts can
 * both call the exact same logic instead of duplicating it.
 */
export async function getNotesByOwner(
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
): Promise<Note[]> {
  await delay(150);
  return readNotes()
    .filter(
      (note) =>
        note.workspace_id === workspaceId && note.owner_type === ownerType && note.owner_id === ownerId,
    )
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return b.created_at.localeCompare(a.created_at);
    });
}

export async function createNoteForOwner(
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
  input: NoteFormInput,
): Promise<DataResult<Note>> {
  const parsed = noteFormSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const timestamp = nowIso();
  const note: Note = {
    id: generateId("note"),
    workspace_id: workspaceId,
    owner_type: ownerType,
    owner_id: ownerId,
    ...parsed.data,
    is_pinned: false,
    attachments: [],
    created_by: CURRENT_ACTOR,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeNotes([...readNotes(), note]);
  recordTimelineActivity(workspaceId, ownerType, ownerId, "note_added", `Note added: "${note.title}"`);

  return ok(note);
}

/**
 * Toggles pin state for a note by id alone — no `ownerType` needed, since
 * the note row already carries its own `owner_type`. Every module's mock
 * repository previously reimplemented this same "find by id, guard by
 * owner_type, flip is_pinned" logic inline (grep for togglePin in each
 * module's mockRepository.ts); this is the one shared version future
 * modules should call instead of writing a new copy. Returns `null` only
 * when no note with this id exists at all — callers that need to guard a
 * specific owner_type can check `result.data.owner_type` themselves.
 */
export async function togglePinNoteById(noteId: string): Promise<DataResult<Note> | null> {
  await delay(150);
  const notes = readNotes();
  const existing = notes.find((note) => note.id === noteId);
  if (!existing) return null;

  const nextPinned = !existing.is_pinned;
  const updated: Note = { ...existing, is_pinned: nextPinned, updated_at: nowIso() };
  writeNotes(notes.map((note) => (note.id === noteId ? updated : note)));
  recordTimelineActivity(
    existing.workspace_id,
    existing.owner_type,
    existing.owner_id,
    nextPinned ? "note_pinned" : "note_unpinned",
    `${nextPinned ? "Note pinned" : "Note unpinned"}: "${existing.title}"`,
  );

  return ok(updated);
}

export async function getTimelineByOwner(
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
): Promise<TimelineActivity[]> {
  await delay(150);
  return readActivities()
    .filter(
      (activity) =>
        activity.workspace_id === workspaceId &&
        activity.owner_type === ownerType &&
        activity.owner_id === ownerId,
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
