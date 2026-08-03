import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  createEventServiceNote: vi.fn(),
  updateEventServiceNote: vi.fn(),
  toggleEventServiceNotePin: vi.fn(),
}));

import { useEventServiceNoteMutations } from "@/modules/services/hooks/useEventServiceNoteMutations";
import { createEventServiceNote, updateEventServiceNote, toggleEventServiceNotePin } from "@/lib/data";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { createTestQueryClient, createWrapper } from "@/modules/services/hooks/testUtils";

const noteInput = { title: "Setup note", content: "Confirm access with venue.", category: "operations", priority: "normal" } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useEventServiceNoteMutations", () => {
  it("creates a note scoped to this EventService and invalidates its workspace cache", async () => {
    vi.mocked(createEventServiceNote).mockResolvedValue({ success: true, data: { id: "note_1" } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useEventServiceNoteMutations("es_1"), { wrapper: createWrapper(queryClient) });

    act(() => {
      result.current.createNote.mutate(noteInput);
    });

    await waitFor(() => expect(result.current.createNote.isSuccess).toBe(true));
    expect(createEventServiceNote).toHaveBeenCalledWith("es_1", noteInput);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: serviceKeys.eventServiceWorkspace("es_1") });
  });

  it("updates an existing note by id", async () => {
    vi.mocked(updateEventServiceNote).mockResolvedValue({ success: true, data: { id: "note_1" } } as never);
    const { result } = renderHook(() => useEventServiceNoteMutations("es_1"), { wrapper: createWrapper() });

    act(() => {
      result.current.updateNote.mutate({ noteId: "note_1", input: noteInput });
    });

    await waitFor(() => expect(result.current.updateNote.isSuccess).toBe(true));
    expect(updateEventServiceNote).toHaveBeenCalledWith("note_1", noteInput);
  });

  it("toggles a note's pin state", async () => {
    vi.mocked(toggleEventServiceNotePin).mockResolvedValue({ success: true, data: { id: "note_1", is_pinned: true } } as never);
    const { result } = renderHook(() => useEventServiceNoteMutations("es_1"), { wrapper: createWrapper() });

    act(() => {
      result.current.togglePin.mutate("note_1");
    });

    await waitFor(() => expect(result.current.togglePin.isSuccess).toBe(true));
    expect(toggleEventServiceNotePin).toHaveBeenCalledWith("note_1");
  });

  it("surfaces a 'note not found' failure through the mutation's error state", async () => {
    vi.mocked(toggleEventServiceNotePin).mockResolvedValue({ success: false, error: "Note not found." } as never);
    const { result } = renderHook(() => useEventServiceNoteMutations("es_1"), { wrapper: createWrapper() });

    act(() => {
      result.current.togglePin.mutate("missing_note");
    });

    await waitFor(() => expect(result.current.togglePin.isError).toBe(true));
    expect(result.current.togglePin.error).toMatchObject({ message: "Note not found." });
  });
});
