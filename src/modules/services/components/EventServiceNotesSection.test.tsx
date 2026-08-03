import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/data", () => ({
  createEventServiceNote: vi.fn(),
  updateEventServiceNote: vi.fn(),
  toggleEventServiceNotePin: vi.fn(),
}));

import { EventServiceNotesSection } from "@/modules/services/components/EventServiceNotesSection";
import { createEventServiceNote, toggleEventServiceNotePin } from "@/lib/data";
import type { Note } from "@/types/note";

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: "note_1",
    workspace_id: "ws",
    owner_type: "event_service",
    owner_id: "es_1",
    title: "Setup note",
    content: "Confirm access with venue.",
    category: "general",
    priority: "normal",
    is_pinned: false,
    attachments: [],
    created_by: "owner",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EventServiceNotesSection", () => {
  it("renders existing notes passed from the already-fetched workspace, no separate fetch", () => {
    renderWithClient(<EventServiceNotesSection workspaceId="ws" eventServiceId="es_1" status="confirmed" notes={[note()]} />);
    expect(screen.getByText("Setup note")).toBeInTheDocument();
  });

  it("creates a new note scoped to this EventService", async () => {
    const user = userEvent.setup();
    vi.mocked(createEventServiceNote).mockResolvedValue({ success: true, data: note({ id: "note_2" }) } as never);
    renderWithClient(<EventServiceNotesSection workspaceId="ws" eventServiceId="es_1" status="confirmed" notes={[]} />);

    await user.click(screen.getByRole("button", { name: "Add note" }));
    await user.type(screen.getByLabelText("Title", { exact: false }), "Reminder");
    await user.type(screen.getByLabelText("Content", { exact: false }), "Bring extra chairs.");
    await user.click(screen.getByRole("button", { name: "Add note" }));

    await waitFor(() => expect(createEventServiceNote).toHaveBeenCalledWith("es_1", expect.objectContaining({ title: "Reminder" })));
  });

  it("toggles a note's pin state", async () => {
    const user = userEvent.setup();
    vi.mocked(toggleEventServiceNotePin).mockResolvedValue({ success: true, data: note({ is_pinned: true }) } as never);
    renderWithClient(<EventServiceNotesSection workspaceId="ws" eventServiceId="es_1" status="confirmed" notes={[note()]} />);

    await user.click(screen.getByRole("button", { name: /pin note: setup note/i }));
    await waitFor(() => expect(toggleEventServiceNotePin).toHaveBeenCalledWith("note_1"));
  });

  it("goes read-only once the assignment reaches a terminal status, hiding the create form", () => {
    renderWithClient(<EventServiceNotesSection workspaceId="ws" eventServiceId="es_1" status="completed" notes={[note()]} />);
    expect(screen.queryByRole("button", { name: /add note/i })).not.toBeInTheDocument();
  });
});
