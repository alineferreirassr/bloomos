import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VendorNotesSection } from "@/modules/vendors/components/VendorNotesSection";
import type { Note } from "@/types/note";
import type { DataResult } from "@/lib/data/result";

vi.mock("@/lib/data", () => ({
  getNotesByVendorId: vi.fn(),
  createVendorNote: vi.fn(),
  updateVendorNote: vi.fn(),
  toggleVendorNotePin: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note_1",
    workspace_id: "ws_test",
    owner_type: "vendor",
    owner_id: "vendor_1",
    title: "Delivery preference",
    content: "Prefers morning deliveries.",
    category: "general",
    priority: "normal",
    is_pinned: false,
    attachments: [],
    created_by: "Amoré Bloom Team",
    created_at: "2026-01-01T12:00:00.000Z",
    updated_at: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}

function ok<T>(data: T): DataResult<T> {
  return { success: true, data };
}

function fail(error: string): DataResult<never> {
  return { success: false, error };
}

async function fillAndSubmitNoteForm(user: ReturnType<typeof userEvent.setup>, { title, content }: { title: string; content: string }) {
  if (title) await user.type(screen.getByLabelText(/title/i), title);
  if (content) await user.type(screen.getByLabelText(/content/i), content);
  await user.click(screen.getByRole("button", { name: /add note|^save$/i }));
}

describe("VendorNotesSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows a loading state before notes resolve", () => {
    vi.mocked(dataLayer.getNotesByVendorId).mockReturnValue(new Promise(() => {}));

    const { container } = render(<VendorNotesSection workspaceId="ws_test" vendorId="vendor_1" />);

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("shows the Vendor-specific empty state when there are no notes", async () => {
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);

    render(<VendorNotesSection workspaceId="ws_test" vendorId="vendor_1" />);

    expect(await screen.findByText("No notes yet")).toBeInTheDocument();
    expect(screen.getByText("Add the first note for this Vendor.")).toBeInTheDocument();
  });

  it("shows an error state with retry when loading fails, and retry re-fetches", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getNotesByVendorId).mockRejectedValueOnce(new Error("boom"));

    render(<VendorNotesSection workspaceId="ws_test" vendorId="vendor_1" />);

    expect(await screen.findByText(/could not load this vendor's notes/i)).toBeInTheDocument();

    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValueOnce([makeNote()]);
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Delivery preference")).toBeInTheDocument();
  });

  it("renders a populated notes list with author and created timestamp", async () => {
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([
      makeNote({ title: "Delivery preference", content: "Prefers morning deliveries.", created_by: "Jordan Ellis" }),
    ]);

    render(<VendorNotesSection workspaceId="ws_test" vendorId="vendor_1" />);

    expect(await screen.findByText("Delivery preference")).toBeInTheDocument();
    expect(screen.getByText("Prefers morning deliveries.")).toBeInTheDocument();
    expect(screen.getByText(/Jordan Ellis/)).toBeInTheDocument();
    expect(screen.getByText(/1\/1\/2026|01\/01\/2026/)).toBeInTheDocument();
  });

  it("passes owner type 'vendor' and the vendor id through to getNotesByVendorId", async () => {
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);

    render(<VendorNotesSection workspaceId="ws_test" vendorId="vendor_42" />);

    await screen.findByText("No notes yet");
    expect(dataLayer.getNotesByVendorId).toHaveBeenCalledWith("vendor_42");

    const container = document.querySelector("[data-owner-type]");
    expect(container).toHaveAttribute("data-owner-type", "vendor");
    expect(container).toHaveAttribute("data-owner-id", "vendor_42");
    expect(container).toHaveAttribute("data-workspace-id", "ws_test");
  });

  it("creates a note successfully and clears the composer", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.createVendorNote).mockResolvedValue(ok(makeNote({ id: "note_new", title: "New note", content: "Some content" })));

    render(<VendorNotesSection workspaceId="ws_test" vendorId="vendor_1" />);

    await screen.findByText("No notes yet");
    await user.click(screen.getByRole("button", { name: /add note/i }));
    await fillAndSubmitNoteForm(user, { title: "New note", content: "Some content" });

    await waitFor(() => expect(dataLayer.createVendorNote).toHaveBeenCalledWith("vendor_1", expect.objectContaining({ title: "New note", content: "Some content" })));
    // Composer closes on success — its Title field is gone.
    await waitFor(() => expect(screen.queryByLabelText(/title/i)).not.toBeInTheDocument());
  });

  it("blocks creating a note with empty content", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);

    render(<VendorNotesSection workspaceId="ws_test" vendorId="vendor_1" />);

    await screen.findByText("No notes yet");
    await user.click(screen.getByRole("button", { name: /add note/i }));
    await user.type(screen.getByLabelText(/title/i), "Has a title");
    await user.click(screen.getByRole("button", { name: /^add note$/i }));

    expect(await screen.findByText(/note content is required/i)).toBeInTheDocument();
    expect(dataLayer.createVendorNote).not.toHaveBeenCalled();
  });

  it("blocks creating a note with whitespace-only content", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);

    render(<VendorNotesSection workspaceId="ws_test" vendorId="vendor_1" />);

    await screen.findByText("No notes yet");
    await user.click(screen.getByRole("button", { name: /add note/i }));
    await user.type(screen.getByLabelText(/title/i), "Has a title");
    await user.type(screen.getByLabelText(/content/i), "   ");
    await user.click(screen.getByRole("button", { name: /^add note$/i }));

    expect(await screen.findByText(/note content is required/i)).toBeInTheDocument();
    expect(dataLayer.createVendorNote).not.toHaveBeenCalled();
  });

  it("preserves typed content and shows the error when create fails", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.createVendorNote).mockResolvedValue(fail("Something went wrong."));

    render(<VendorNotesSection workspaceId="ws_test" vendorId="vendor_1" />);

    await screen.findByText("No notes yet");
    await user.click(screen.getByRole("button", { name: /add note/i }));
    await fillAndSubmitNoteForm(user, { title: "Keep me", content: "Keep this content" });

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toHaveValue("Keep me");
    expect(screen.getByLabelText(/content/i)).toHaveValue("Keep this content");
  });

  it("prevents a double create submission", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);
    let resolveCreate!: (result: DataResult<Note>) => void;
    vi.mocked(dataLayer.createVendorNote).mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));

    render(<VendorNotesSection workspaceId="ws_test" vendorId="vendor_1" />);

    await screen.findByText("No notes yet");
    await user.click(screen.getByRole("button", { name: /add note/i }));
    await user.type(screen.getByLabelText(/title/i), "Title");
    await user.type(screen.getByLabelText(/content/i), "Content");

    const submitButton = screen.getByRole("button", { name: /add note|saving/i });
    await user.click(submitButton);
    await user.click(submitButton).catch(() => {});

    expect(dataLayer.createVendorNote).toHaveBeenCalledTimes(1);
    resolveCreate(ok(makeNote()));
  });

  it("edits a note successfully", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([makeNote({ title: "Old title", content: "Old content" })]);
    vi.mocked(dataLayer.updateVendorNote).mockResolvedValue(ok(makeNote({ title: "New title", content: "New content" })));

    render(<VendorNotesSection workspaceId="ws_test" vendorId="vendor_1" />);

    await screen.findByText("Old title");
    await user.click(screen.getByRole("button", { name: /edit note: old title/i }));

    const titleField = screen.getByLabelText(/title/i);
    await user.clear(titleField);
    await user.type(titleField, "New title");
    const contentField = screen.getByLabelText(/content/i);
    await user.clear(contentField);
    await user.type(contentField, "New content");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(dataLayer.updateVendorNote).toHaveBeenCalledWith("note_1", expect.objectContaining({ title: "New title", content: "New content" })));
  });

  it("cancels an edit without saving", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([makeNote({ title: "Untouched title" })]);

    render(<VendorNotesSection workspaceId="ws_test" vendorId="vendor_1" />);

    await screen.findByText("Untouched title");
    await user.click(screen.getByRole("button", { name: /edit note: untouched title/i }));
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(await screen.findByText("Untouched title")).toBeInTheDocument();
    expect(dataLayer.updateVendorNote).not.toHaveBeenCalled();
  });

  it("blocks saving an edit with empty content", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([makeNote({ title: "Has content" })]);

    render(<VendorNotesSection workspaceId="ws_test" vendorId="vendor_1" />);

    await screen.findByText("Has content");
    await user.click(screen.getByRole("button", { name: /edit note: has content/i }));
    const contentField = screen.getByLabelText(/content/i);
    await user.clear(contentField);
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText(/note content is required/i)).toBeInTheDocument();
    expect(dataLayer.updateVendorNote).not.toHaveBeenCalled();
  });

  it("keeps the original note visible and shows the error when edit fails", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([makeNote({ title: "Original title", content: "Original content" })]);
    vi.mocked(dataLayer.updateVendorNote).mockResolvedValue(fail("Could not save this note."));

    render(<VendorNotesSection workspaceId="ws_test" vendorId="vendor_1" />);

    await screen.findByText("Original title");
    await user.click(screen.getByRole("button", { name: /edit note: original title/i }));
    const titleField = screen.getByLabelText(/title/i);
    await user.clear(titleField);
    await user.type(titleField, "Attempted change");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText("Could not save this note.")).toBeInTheDocument();
    // The form is still open, still showing the attempted (not lost) edit.
    expect(screen.getByLabelText(/title/i)).toHaveValue("Attempted change");
  });

  it("contains no direct Supabase import", () => {
    const source = readFileSync(path.resolve(__dirname, "VendorNotesSection.tsx"), "utf-8");
    expect(source).not.toMatch(/from ["']@\/lib\/supabase/);
    expect(source).not.toMatch(/createBrowserClient|createSupabaseClient/);
  });

  it("does not introduce a Vendor-only Notes store", () => {
    const source = readFileSync(path.resolve(__dirname, "VendorNotesSection.tsx"), "utf-8");
    expect(source).not.toMatch(/notesStore|NotesStore/);
    expect(source).toMatch(/from ["']@\/lib\/data["']/);
  });

  it("has no delete affordance for notes (Notes are never deleted, by architectural design)", async () => {
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([makeNote({ title: "Fragile handling only" })]);

    render(<VendorNotesSection workspaceId="ws_test" vendorId="vendor_1" />);

    await screen.findByText("Fragile handling only");
    expect(screen.queryByRole("button", { name: /^delete/i })).not.toBeInTheDocument();
  });
});
