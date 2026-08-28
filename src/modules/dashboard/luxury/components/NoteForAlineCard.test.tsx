import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/dashboard/founderNoteActions", () => ({
  createFounderNoteAction: vi.fn(),
}));

import { createFounderNoteAction } from "@/modules/dashboard/founderNoteActions";
import { NoteForAlineCard } from "@/modules/dashboard/luxury/components/NoteForAlineCard";

afterEach(() => {
  vi.clearAllMocks();
});

describe("NoteForAlineCard", () => {
  it("sends a note and clears the field on success", async () => {
    vi.mocked(createFounderNoteAction).mockResolvedValue({
      success: true,
      data: { id: "note_1", workspace_id: "ws_1", author_id: "user_1", body: "Great week!", created_at: "x" },
    });

    const user = userEvent.setup();
    render(<NoteForAlineCard />);

    const textarea = screen.getByPlaceholderText("Write something just for Aline…");
    await user.type(textarea, "Great week!");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText("Sent ♡")).toBeInTheDocument());
    expect(textarea).toHaveValue("");
    expect(createFounderNoteAction).toHaveBeenCalledWith("Great week!");
  });

  it("surfaces a recoverable error on a failed submit and keeps the typed text", async () => {
    vi.mocked(createFounderNoteAction).mockResolvedValue({ success: false, error: "Something went wrong." });

    const user = userEvent.setup();
    render(<NoteForAlineCard />);

    const textarea = screen.getByPlaceholderText("Write something just for Aline…");
    await user.type(textarea, "A note that will fail to send.");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText("Something went wrong.")).toBeInTheDocument());
    expect(textarea).toHaveValue("A note that will fail to send.");
    expect(screen.queryByText("Sent ♡")).not.toBeInTheDocument();
  });

  it("disables Send for empty/whitespace-only input, never calling the action", async () => {
    const user = userEvent.setup();
    render(<NoteForAlineCard />);

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Write something just for Aline…"), "   ");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(createFounderNoteAction).not.toHaveBeenCalled();
  });

  it("append-only by design — no edit or delete control exists anywhere in the card", () => {
    render(<NoteForAlineCard />);
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retract/i })).not.toBeInTheDocument();
  });
});
