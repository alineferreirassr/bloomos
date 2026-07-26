import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEventServiceNote, updateEventServiceNote, toggleEventServiceNotePin } from "@/lib/data";
import type { NoteFormInput } from "@/modules/notes/schema";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { throwIfFailed } from "@/modules/services/hooks/errorContract";

/**
 * `workspace.data.notes` is already fetched by `getEventServiceWorkspace` —
 * these three mutations are the only piece that was missing to make the
 * Workspace's Notes section fully interactive. Each invalidates the whole
 * `eventServiceWorkspace(eventServiceId)` entry (not a narrower notes-only
 * key) since notes live inside that same bundled query result, exactly
 * like `useUpdateEventServiceOverrides` invalidates the same key for the
 * override fields living in the same bundle.
 */
export function useEventServiceNoteMutations(eventServiceId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: serviceKeys.eventServiceWorkspace(eventServiceId) });

  const createNote = useMutation({
    mutationFn: (input: NoteFormInput) => createEventServiceNote(eventServiceId, input).then(throwIfFailed),
    onSuccess: invalidate,
  });

  const updateNote = useMutation({
    mutationFn: ({ noteId, input }: { noteId: string; input: NoteFormInput }) => updateEventServiceNote(noteId, input).then(throwIfFailed),
    onSuccess: invalidate,
  });

  const togglePin = useMutation({
    mutationFn: (noteId: string) => toggleEventServiceNotePin(noteId).then(throwIfFailed),
    onSuccess: invalidate,
  });

  return { createNote, updateNote, togglePin };
}
