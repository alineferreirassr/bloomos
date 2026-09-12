import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/inspiration/inspirationActions", () => ({
  archiveInspirationItemAction: vi.fn(),
  unarchiveInspirationItemAction: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getMediaAssetDownloadUrl: vi.fn(),
}));

import { archiveInspirationItemAction, unarchiveInspirationItemAction } from "@/modules/inspiration/inspirationActions";
import { getMediaAssetDownloadUrl } from "@/lib/data";
import { InspirationDetailDialog } from "@/modules/inspiration/components/InspirationDetailDialog";
import type { InspirationItem } from "@/types/inspirationItem";

function item(overrides: Partial<InspirationItem> = {}): InspirationItem {
  return {
    id: "insp_1",
    workspace_id: "ws_1",
    title: "Behind the Scenes at a Wedding",
    source_type: "instagram",
    source_url: "https://instagram.com/reel/abc",
    normalized_source_url: "https://instagram.com/reel/abc",
    creator_name: "Jane Doe",
    creator_handle: "janedoe",
    platform_content_id: null,
    content_format: "reel",
    hook: "Open on the veil catching the wind.",
    cta: "Book your consult",
    why_it_works: "Motion-first cold open.",
    notes: "Try this for spring 2027.",
    duration_seconds: null,
    published_at: "2026-08-01T00:00:00Z",
    media_asset_id: null,
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("InspirationDetailDialog", () => {
  it("renders nothing when item is null", () => {
    render(<InspirationDetailDialog item={null} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows read-only details: source, creator, hook, cta, why it works, notes, and dates", () => {
    render(<InspirationDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Behind the Scenes at a Wedding" })).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("Reel")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe · @janedoe")).toBeInTheDocument();
    expect(screen.getByText("Open on the veil catching the wind.")).toBeInTheDocument();
    expect(screen.getByText("Book your consult")).toBeInTheDocument();
    expect(screen.getByText("Motion-first cold open.")).toBeInTheDocument();
    expect(screen.getByText("Try this for spring 2027.")).toBeInTheDocument();
  });

  it("renders a safe external link with target=_blank and rel=noopener noreferrer for a valid http(s) source_url", () => {
    render(<InspirationDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    const link = screen.getByRole("link", { name: "Open source link" });
    expect(link).toHaveAttribute("href", "https://instagram.com/reel/abc");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders no link at all for a manual reference with no source_url", () => {
    render(<InspirationDetailDialog item={item({ source_url: null, source_type: "manual" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.queryByRole("link", { name: "Open source link" })).not.toBeInTheDocument();
  });

  it("shows Archive for an active item and Restore for an archived item, only when canManage", () => {
    const { rerender } = render(<InspirationDetailDialog item={item({ archived_at: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();

    rerender(<InspirationDetailDialog item={item({ archived_at: "2026-09-05T00:00:00Z" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("hides Archive/Restore entirely for a read-only viewer", () => {
    render(<InspirationDetailDialog item={item()} onClose={vi.fn()} canManage={false} onChanged={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
  });

  it("calls archiveInspirationItemAction and reports the updated item back to the caller", async () => {
    const archived = item({ archived_at: "2026-09-05T00:00:00Z" });
    vi.mocked(archiveInspirationItemAction).mockResolvedValue({ success: true, data: archived });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<InspirationDetailDialog item={item({ archived_at: null })} onClose={vi.fn()} canManage onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(archiveInspirationItemAction).toHaveBeenCalledWith("insp_1");
    expect(onChanged).toHaveBeenCalledWith(archived);
  });

  it("calls unarchiveInspirationItemAction from an archived item", async () => {
    const restored = item({ archived_at: null });
    vi.mocked(unarchiveInspirationItemAction).mockResolvedValue({ success: true, data: restored });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<InspirationDetailDialog item={item({ archived_at: "2026-09-05T00:00:00Z" })} onClose={vi.fn()} canManage onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(unarchiveInspirationItemAction).toHaveBeenCalledWith("insp_1");
    expect(onChanged).toHaveBeenCalledWith(restored);
  });

  it("shows a controlled error and never crashes when archive fails", async () => {
    vi.mocked(archiveInspirationItemAction).mockResolvedValue({ success: false, error: "This Inspiration item could not be found." });
    const user = userEvent.setup();
    render(<InspirationDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This Inspiration item could not be found.");
  });

  it("calls onClose from the Close button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<InspirationDetailDialog item={item()} onClose={onClose} canManage onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the platform content ID when present, and suppresses it when null", () => {
    const { rerender } = render(<InspirationDetailDialog item={item({ platform_content_id: "reel_abc123" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.getByText("Content ID: reel_abc123")).toBeInTheDocument();

    rerender(<InspirationDetailDialog item={item({ platform_content_id: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.queryByText(/Content ID/)).not.toBeInTheDocument();
  });

  it("shows duration when present, and suppresses it when null", () => {
    const { rerender } = render(<InspirationDetailDialog item={item({ duration_seconds: 95 })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.getByText(/1:35/)).toBeInTheDocument();

    rerender(<InspirationDetailDialog item={item({ duration_seconds: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.queryByText(/^\d+:\d{2}/)).not.toBeInTheDocument();
  });

  it("renders a MediaAsset preview when media_asset_id is present", async () => {
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/photo.jpg", expiresAt: "2026-01-01T00:00:00Z" } });
    render(<InspirationDetailDialog item={item({ media_asset_id: "asset_1" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    const img = await screen.findByRole("img");
    expect(img).toHaveAttribute("src", "https://signed.example.com/photo.jpg");
  });

  it("shows the placeholder fallback, never a broken image, when there is no MediaAsset", () => {
    render(<InspirationDetailDialog item={item({ media_asset_id: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(document.querySelector("img")).not.toBeInTheDocument();
  });

  it("shows an Edit action for an active item when canManage and onEdit are provided", () => {
    render(<InspirationDetailDialog item={item({ archived_at: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("calls onEdit with the current item when Edit is clicked", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<InspirationDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} onEdit={onEdit} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "insp_1" }));
  });

  it("hides Edit for an archived item — editing is blocked server-side until restored", () => {
    render(<InspirationDetailDialog item={item({ archived_at: "2026-09-05T00:00:00Z" })} onClose={vi.fn()} canManage onChanged={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("hides Edit for a read-only viewer even when onEdit is provided", () => {
    render(<InspirationDetailDialog item={item()} onClose={vi.fn()} canManage={false} onChanged={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("hides Edit entirely when no onEdit callback is supplied", () => {
    render(<InspirationDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});
