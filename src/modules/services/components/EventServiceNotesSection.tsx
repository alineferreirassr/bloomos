"use client";

import { NotesSection } from "@/modules/notes/components/NotesSection";
import { useEventServiceNoteMutations } from "@/modules/services/hooks/useEventServiceNoteMutations";
import { canOverrideEventService, type EventServiceStatus } from "@/core/workflows/eventServiceWorkflow";
import type { DataResult } from "@/lib/data/result";
import type { Note } from "@/types/note";
import type { NoteFormInput } from "@/modules/notes/schema";

interface EventServiceNotesSectionProps {
  workspaceId: string;
  eventServiceId: string;
  status: EventServiceStatus;
  notes: Note[];
}

/**
 * `useEventServiceNoteMutations` follows the Services module's own
 * `useMutation` + `throwIfFailed` convention (throws on failure so
 * `isError`/`error` populate consistently, matching every other Services
 * hook) — but `NotesSection`'s existing contract (shared by every module
 * that already uses it) expects each callback to resolve to a `DataResult`,
 * never reject. `toDataResult` is the one small adapter between those two
 * conventions, kept local to this wrapper rather than changing either
 * established pattern.
 */
async function toDataResult<T>(promise: Promise<T>): Promise<DataResult<T>> {
  try {
    return { success: true, data: await promise };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export function EventServiceNotesSection({ workspaceId, eventServiceId, status, notes }: EventServiceNotesSectionProps) {
  const { createNote, updateNote, togglePin } = useEventServiceNoteMutations(eventServiceId);
  const readOnly = !canOverrideEventService(status);

  return (
    <NotesSection
      workspaceId={workspaceId}
      ownerType="event_service"
      ownerId={eventServiceId}
      notes={notes}
      onCreateNote={(input: NoteFormInput) => toDataResult(createNote.mutateAsync(input))}
      onUpdateNote={(noteId: string, input: NoteFormInput) => toDataResult(updateNote.mutateAsync({ noteId, input }))}
      onTogglePin={(noteId: string) => toDataResult(togglePin.mutateAsync(noteId))}
      readOnly={readOnly}
      onNotesChanged={() => {}}
    />
  );
}
