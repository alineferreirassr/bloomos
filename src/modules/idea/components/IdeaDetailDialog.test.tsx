import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/idea/ideaActions", () => ({
  archiveIdeaItemAction: vi.fn(),
  unarchiveIdeaItemAction: vi.fn(),
}));

import { archiveIdeaItemAction, unarchiveIdeaItemAction } from "@/modules/idea/ideaActions";
import { IdeaDetailDialog } from "@/modules/idea/components/IdeaDetailDialog";
import type { IdeaItem } from "@/types/ideaItem";

function item(overrides: Partial<IdeaItem> = {}): IdeaItem {
  return {
    id: "idea_1",
    workspace_id: "ws_1",
    title: "Behind the scenes at a spring wedding",
    description: "A short reel following setup to first dance.",
    status: "active",
    source_inspiration_id: null,
    content_format: "reel",
    hook: "Open on the veil catching the wind.",
    cta: "Book your consult",
    audience: "Engaged couples planning spring weddings",
    notes: "Try this for spring 2027.",
    media_asset_id: null,
    priority: "high",
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

describe("IdeaDetailDialog", () => {
  it("renders nothing when item is null", () => {
    render(<IdeaDetailDialog item={null} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows read-only details: description, priority, content format, hook, cta, audience, and notes", () => {
    render(<IdeaDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Behind the scenes at a spring wedding" })).toBeInTheDocument();
    expect(screen.getByText("A short reel following setup to first dance.")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Reel")).toBeInTheDocument();
    expect(screen.getByText("Open on the veil catching the wind.")).toBeInTheDocument();
    expect(screen.getByText("Book your consult")).toBeInTheDocument();
    expect(screen.getByText("Engaged couples planning spring weddings")).toBeInTheDocument();
    expect(screen.getByText("Try this for spring 2027.")).toBeInTheDocument();
  });

  it("renders without a broken UI when every optional field is null", () => {
    render(
      <IdeaDetailDialog
        item={item({ content_format: null, priority: null, hook: null, cta: null, audience: null, notes: null })}
        onClose={vi.fn()}
        canManage
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText("Behind the scenes at a spring wedding")).toBeInTheDocument();
  });

  it("shows Archive for an active item and Restore for an archived item, only when canManage", () => {
    const { rerender } = render(<IdeaDetailDialog item={item({ archived_at: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();

    rerender(<IdeaDetailDialog item={item({ archived_at: "2026-09-21T00:00:00Z" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("hides Archive/Restore entirely for a read-only viewer", () => {
    render(<IdeaDetailDialog item={item()} onClose={vi.fn()} canManage={false} onChanged={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
  });

  it("calls archiveIdeaItemAction and reports the updated item back to the caller", async () => {
    const archived = item({ archived_at: "2026-09-21T00:00:00Z" });
    vi.mocked(archiveIdeaItemAction).mockResolvedValue({ success: true, data: archived });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<IdeaDetailDialog item={item({ archived_at: null })} onClose={vi.fn()} canManage onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(archiveIdeaItemAction).toHaveBeenCalledWith("idea_1");
    expect(onChanged).toHaveBeenCalledWith(archived);
  });

  it("calls unarchiveIdeaItemAction from an archived item", async () => {
    const restored = item({ archived_at: null });
    vi.mocked(unarchiveIdeaItemAction).mockResolvedValue({ success: true, data: restored });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<IdeaDetailDialog item={item({ archived_at: "2026-09-21T00:00:00Z" })} onClose={vi.fn()} canManage onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(unarchiveIdeaItemAction).toHaveBeenCalledWith("idea_1");
    expect(onChanged).toHaveBeenCalledWith(restored);
  });

  it("shows a controlled error and never crashes when archive fails", async () => {
    vi.mocked(archiveIdeaItemAction).mockResolvedValue({ success: false, error: "This Idea could not be found." });
    const user = userEvent.setup();
    render(<IdeaDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This Idea could not be found.");
  });

  it("calls onClose from the Close button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<IdeaDetailDialog item={item()} onClose={onClose} canManage onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("has no Edit action in this checkpoint — editing is SOCIAL-07E scope", () => {
    render(<IdeaDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("never renders raw HTML from description/notes — plain text only", () => {
    render(<IdeaDetailDialog item={item({ notes: "<img src=x onerror=alert(1)>" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  });
});
