import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/idea/ideaActions", () => ({
  archiveIdeaItemAction: vi.fn(),
  unarchiveIdeaItemAction: vi.fn(),
}));
vi.mock("@/modules/inspiration/inspirationActions", () => ({
  getInspirationItemAction: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getMediaAssetDownloadUrl: vi.fn(),
}));
vi.mock("@/modules/aiGeneration/aiGenerationActions", () => ({
  listAIGenerationsAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
  approveAIGenerationAction: vi.fn(),
  rejectAIGenerationAction: vi.fn(),
}));
vi.mock("@/modules/ai/contentIntelligence/analyzeContentAction", () => ({
  analyzeContentAction: vi.fn(),
}));

import { archiveIdeaItemAction, unarchiveIdeaItemAction } from "@/modules/idea/ideaActions";
import { getInspirationItemAction } from "@/modules/inspiration/inspirationActions";
import { getMediaAssetDownloadUrl } from "@/lib/data";
import { IdeaDetailDialog } from "@/modules/idea/components/IdeaDetailDialog";
import type { IdeaItem } from "@/types/ideaItem";
import type { InspirationItem } from "@/types/inspirationItem";

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

function inspirationItem(overrides: Partial<InspirationItem> = {}): InspirationItem {
  return {
    id: "insp_1",
    workspace_id: "ws_1",
    title: "Studio tour reel",
    source_type: "instagram",
    source_url: null,
    normalized_source_url: null,
    creator_name: null,
    creator_handle: null,
    platform_content_id: null,
    content_format: null,
    hook: null,
    cta: null,
    why_it_works: null,
    notes: null,
    duration_seconds: null,
    published_at: null,
    media_asset_id: null,
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
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

  it("never renders raw HTML from description/notes — plain text only", () => {
    render(<IdeaDetailDialog item={item({ notes: "<img src=x onerror=alert(1)>" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  });

  describe("SOCIAL-07E — Edit entry point", () => {
    it("shows an Edit action for an active item when canManage and onEdit are provided", () => {
      render(<IdeaDetailDialog item={item({ archived_at: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} onEdit={vi.fn()} />);
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    });

    it("calls onEdit with the current item when Edit is clicked", async () => {
      const onEdit = vi.fn();
      const user = userEvent.setup();
      render(<IdeaDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} onEdit={onEdit} />);
      await user.click(screen.getByRole("button", { name: "Edit" }));
      expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "idea_1" }));
    });

    it("hides Edit for an archived item — editing is blocked server-side until restored", () => {
      render(<IdeaDetailDialog item={item({ archived_at: "2026-09-21T00:00:00Z" })} onClose={vi.fn()} canManage onChanged={vi.fn()} onEdit={vi.fn()} />);
      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    });

    it("hides Edit for a read-only viewer even when onEdit is provided", () => {
      render(<IdeaDetailDialog item={item()} onClose={vi.fn()} canManage={false} onChanged={vi.fn()} onEdit={vi.fn()} />);
      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    });

    it("hides Edit entirely when no onEdit callback is supplied", () => {
      render(<IdeaDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    });
  });

  describe("SOCIAL-07E — linked Inspiration display", () => {
    it("shows no Inspiration line when there is no source_inspiration_id", () => {
      render(<IdeaDetailDialog item={item({ source_inspiration_id: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
      expect(screen.queryByText(/Inspired by/)).not.toBeInTheDocument();
    });

    it("resolves and shows the linked Inspiration's own title only, never its own hook/content", async () => {
      vi.mocked(getInspirationItemAction).mockResolvedValue({ success: true, data: inspirationItem({ hook: "The reference's own hook" }) });
      render(<IdeaDetailDialog item={item({ source_inspiration_id: "insp_1" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      expect(await screen.findByText("Inspired by: Studio tour reel")).toBeInTheDocument();
      expect(screen.queryByText("The reference's own hook")).not.toBeInTheDocument();
    });

    it("degrades gracefully when the linked Inspiration cannot be resolved", async () => {
      vi.mocked(getInspirationItemAction).mockResolvedValue({ success: false, error: "This Inspiration item could not be found." });
      render(<IdeaDetailDialog item={item({ source_inspiration_id: "insp_missing" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      await screen.findByText("Behind the scenes at a spring wedding");
      expect(getInspirationItemAction).toHaveBeenCalledWith("insp_missing");
    });
  });

  describe("SOCIAL-07E — linked MediaAsset preview", () => {
    it("renders a MediaAsset preview when media_asset_id is present", async () => {
      vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/photo.jpg", expiresAt: "2026-01-01T00:00:00Z" } });
      render(<IdeaDetailDialog item={item({ media_asset_id: "asset_1" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
      const img = await screen.findByRole("img");
      expect(img).toHaveAttribute("src", "https://signed.example.com/photo.jpg");
    });

    it("shows no image element when there is no MediaAsset", () => {
      render(<IdeaDetailDialog item={item({ media_asset_id: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
      expect(document.querySelector("img")).not.toBeInTheDocument();
    });
  });
});
