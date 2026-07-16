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
