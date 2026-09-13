import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/idea/ideaActions", () => ({
  createIdeaItemAction: vi.fn(),
}));

import { createIdeaItemAction } from "@/modules/idea/ideaActions";
import { AddIdeaDialog } from "@/modules/idea/components/AddIdeaDialog";
import type { IdeaItem } from "@/types/ideaItem";

function createdItem(overrides: Partial<IdeaItem> = {}): IdeaItem {
  return {
    id: "idea_new",
    workspace_id: "ws_1",
    title: "New idea",
    description: "A fresh concept.",
    status: "active",
    source_inspiration_id: null,
    content_format: null,
    hook: null,
    cta: null,
    audience: null,
    notes: null,
    media_asset_id: null,
    priority: null,
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-09-20T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("AddIdeaDialog", () => {
  it("renders nothing when closed", () => {
    render(<AddIdeaDialog open={false} onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires a non-empty title before submitting", async () => {
    const user = userEvent.setup();
    render(<AddIdeaDialog open onClose={vi.fn()} onCreated={vi.fn()} />);
    await user.type(screen.getByLabelText("Description"), "A fresh concept.");
    await user.click(screen.getByRole("button", { name: "Create Idea" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Title is required.");
    expect(createIdeaItemAction).not.toHaveBeenCalled();
  });

  it("requires a non-empty description before submitting", async () => {
    const user = userEvent.setup();
    render(<AddIdeaDialog open onClose={vi.fn()} onCreated={vi.fn()} />);
    await user.type(screen.getByLabelText("Title"), "New idea");
    await user.click(screen.getByRole("button", { name: "Create Idea" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Description is required.");
    expect(createIdeaItemAction).not.toHaveBeenCalled();
  });

  it("creates an idea with only title and description filled in", async () => {
    vi.mocked(createIdeaItemAction).mockResolvedValue({ success: true, data: createdItem() });
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(<AddIdeaDialog open onClose={onClose} onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Title"), "New idea");
    await user.type(screen.getByLabelText("Description"), "A fresh concept.");
    await user.click(screen.getByRole("button", { name: "Create Idea" }));

    expect(createIdeaItemAction).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New idea",
        description: "A fresh concept.",
        source_inspiration_id: null,
        media_asset_id: null,
        content_format: null,
        priority: null,
      }),
    );
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("submits the selected content format and priority", async () => {
    vi.mocked(createIdeaItemAction).mockResolvedValue({ success: true, data: createdItem() });
    const user = userEvent.setup();
    render(<AddIdeaDialog open onClose={vi.fn()} onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "New idea");
    await user.type(screen.getByLabelText("Description"), "A fresh concept.");
    await user.selectOptions(screen.getByLabelText("Content Format (optional)"), "reel");
    await user.selectOptions(screen.getByLabelText("Priority (optional)"), "high");
    await user.click(screen.getByRole("button", { name: "Create Idea" }));

    expect(createIdeaItemAction).toHaveBeenCalledWith(expect.objectContaining({ content_format: "reel", priority: "high" }));
  });

  it("never sends workspace_id, status, or created_by from the browser", async () => {
    vi.mocked(createIdeaItemAction).mockResolvedValue({ success: true, data: createdItem() });
    const user = userEvent.setup();
    render(<AddIdeaDialog open onClose={vi.fn()} onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "New idea");
    await user.type(screen.getByLabelText("Description"), "A fresh concept.");
    await user.click(screen.getByRole("button", { name: "Create Idea" }));

    const sentInput = vi.mocked(createIdeaItemAction).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(sentInput).not.toHaveProperty("workspace_id");
    expect(sentInput).not.toHaveProperty("status");
    expect(sentInput).not.toHaveProperty("created_by");
  });

  it("does not offer a source_inspiration_id or media_asset_id field in this checkpoint", () => {
    render(<AddIdeaDialog open onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.queryByLabelText(/inspiration/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/media|file|image/i)).not.toBeInTheDocument();
  });

  it("shows a controlled error from the server without crashing or closing", async () => {
    vi.mocked(createIdeaItemAction).mockResolvedValue({ success: false, error: "That isn't available. You may not have access to it." });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AddIdeaDialog open onClose={onClose} onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "New idea");
    await user.type(screen.getByLabelText("Description"), "A fresh concept.");
    await user.click(screen.getByRole("button", { name: "Create Idea" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That isn't available. You may not have access to it.");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("resets its fields on the next open after a previous session", async () => {
    vi.mocked(createIdeaItemAction).mockResolvedValue({ success: true, data: createdItem() });
    const user = userEvent.setup();
    const { rerender } = render(<AddIdeaDialog open onClose={vi.fn()} onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "Stale text");
    rerender(<AddIdeaDialog open={false} onClose={vi.fn()} onCreated={vi.fn()} />);
    rerender(<AddIdeaDialog open onClose={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.getByLabelText("Title")).toHaveValue("");
  });
});
