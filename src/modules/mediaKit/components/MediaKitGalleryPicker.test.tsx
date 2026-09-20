import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MediaKitGalleryPicker } from "@/modules/mediaKit/components/MediaKitGalleryPicker";
import type { MediaKitGalleryItem } from "@/types/mediaKit";
import type { MediaAsset } from "@/types/mediaAsset";

vi.mock("@/lib/data", () => ({ getMediaAssetDownloadUrl: vi.fn(() => new Promise(() => {})), listMediaAssetsForWorkspace: vi.fn() }));
vi.mock("@/modules/mediaKit/getMediaKitGalleryItemsData", () => ({ getMediaKitGalleryItemsData: vi.fn() }));
vi.mock("@/modules/mediaKit/addMediaKitGalleryItemAction", () => ({ addMediaKitGalleryItemAction: vi.fn() }));
vi.mock("@/modules/mediaKit/updateMediaKitGalleryItemAction", () => ({ updateMediaKitGalleryItemAction: vi.fn() }));
vi.mock("@/modules/mediaKit/archiveMediaKitGalleryItemAction", () => ({ archiveMediaKitGalleryItemAction: vi.fn() }));
vi.mock("@/modules/mediaKit/reorderMediaKitGalleryItemsAction", () => ({ reorderMediaKitGalleryItemsAction: vi.fn() }));

import { getMediaKitGalleryItemsData } from "@/modules/mediaKit/getMediaKitGalleryItemsData";
import { listMediaAssetsForWorkspace } from "@/lib/data";
import { addMediaKitGalleryItemAction } from "@/modules/mediaKit/addMediaKitGalleryItemAction";
import { updateMediaKitGalleryItemAction } from "@/modules/mediaKit/updateMediaKitGalleryItemAction";
import { reorderMediaKitGalleryItemsAction } from "@/modules/mediaKit/reorderMediaKitGalleryItemsAction";

function makeItem(overrides: Partial<MediaKitGalleryItem> = {}): MediaKitGalleryItem {
  return {
    id: "gallery_1",
    workspace_id: "workspace_1",
    media_kit_id: "mk_1",
    portfolio_item_id: null,
    media_asset_id: "asset_1",
    caption: null,
    is_cover: false,
    is_included: true,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

function makeAsset(id: string, filename: string): MediaAsset {
  return {
    id,
    workspace_id: "workspace_1",
    owner_type: "workspace",
    owner_id: "workspace_1",
    original_filename: filename,
    stored_filename: filename,
    storage_bucket: "media-assets",
    storage_path: `workspace_1/${filename}`,
    mime_type: "image/jpeg",
    extension: "jpg",
    file_size: 1000,
    checksum: "abc",
    width: 800,
    height: 600,
    duration: null,
    version: 1,
    uploaded_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    folder_id: null,
    tags: [],
    color_label: null,
    priority: null,
    ai_ready: false,
    status: "approved",
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    version_notes: null,
    metadata: {} as MediaAsset["metadata"],
  };
}

describe("MediaKitGalleryPicker", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays existing gallery images for the given scope", async () => {
    vi.mocked(getMediaKitGalleryItemsData).mockResolvedValue({ success: true, data: [makeItem()] });
    render(<MediaKitGalleryPicker workspaceId="workspace_1" portfolioItemId={null} onChanged={vi.fn()} />);
    expect(await screen.findByLabelText("Caption")).toBeInTheDocument();
    expect(vi.mocked(getMediaKitGalleryItemsData)).toHaveBeenCalledWith(null);
  });

  it("reads a specific portfolio item's own gallery scope when portfolioItemId is set", async () => {
    vi.mocked(getMediaKitGalleryItemsData).mockResolvedValue({ success: true, data: [] });
    render(<MediaKitGalleryPicker workspaceId="workspace_1" portfolioItemId="portfolio_1" onChanged={vi.fn()} />);
    await screen.findByText("No images yet");
    expect(vi.mocked(getMediaKitGalleryItemsData)).toHaveBeenCalledWith("portfolio_1");
  });

  it("adding an existing Media Asset calls the add action and reuses it — never creates a new asset", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    vi.mocked(getMediaKitGalleryItemsData).mockResolvedValueOnce({ success: true, data: [] });
    vi.mocked(listMediaAssetsForWorkspace).mockResolvedValue([makeAsset("asset_1", "photo.jpg")]);
    vi.mocked(addMediaKitGalleryItemAction).mockResolvedValue({ success: true, data: makeItem() });
    vi.mocked(getMediaKitGalleryItemsData).mockResolvedValueOnce({ success: true, data: [makeItem()] });

    render(<MediaKitGalleryPicker workspaceId="workspace_1" portfolioItemId={null} onChanged={onChanged} />);
    await screen.findByText("No images yet");
    await user.click(screen.getByRole("button", { name: "Add from Media Library" }));
    await user.click(await screen.findByText("photo.jpg"));

    expect(vi.mocked(addMediaKitGalleryItemAction)).toHaveBeenCalledWith(null, "asset_1");
    expect(onChanged).toHaveBeenCalled();
  });

  it("include/exclude toggles is_included via the update action", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaKitGalleryItemsData).mockResolvedValue({ success: true, data: [makeItem({ is_included: true })] });
    vi.mocked(updateMediaKitGalleryItemAction).mockResolvedValue({ success: true, data: makeItem({ is_included: false }) });

    render(<MediaKitGalleryPicker workspaceId="workspace_1" portfolioItemId={null} onChanged={vi.fn()} />);
    await screen.findByLabelText("Caption");
    await user.click(screen.getByRole("checkbox", { name: "Included" }));

    expect(vi.mocked(updateMediaKitGalleryItemAction)).toHaveBeenCalledWith("gallery_1", { caption: null, is_cover: false, is_included: false });
  });

  it("cover toggle calls the update action with is_cover true", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaKitGalleryItemsData).mockResolvedValue({ success: true, data: [makeItem({ is_cover: false })] });
    vi.mocked(updateMediaKitGalleryItemAction).mockResolvedValue({ success: true, data: makeItem({ is_cover: true }) });

    render(<MediaKitGalleryPicker workspaceId="workspace_1" portfolioItemId={null} onChanged={vi.fn()} />);
    await screen.findByLabelText("Caption");
    await user.click(screen.getByRole("checkbox", { name: "Cover" }));

    expect(vi.mocked(updateMediaKitGalleryItemAction)).toHaveBeenCalledWith("gallery_1", { caption: null, is_cover: true, is_included: true });
  });

  it("ordering: Move up/down sends the full reordered id array, scoped to this gallery", async () => {
    const user = userEvent.setup();
    const first = makeItem({ id: "gallery_1", media_asset_id: "asset_1", sort_order: 0 });
    const second = makeItem({ id: "gallery_2", media_asset_id: "asset_2", sort_order: 1 });
    vi.mocked(getMediaKitGalleryItemsData).mockResolvedValue({ success: true, data: [first, second] });
    vi.mocked(reorderMediaKitGalleryItemsAction).mockResolvedValue({ success: true, data: [] });

    render(<MediaKitGalleryPicker workspaceId="workspace_1" portfolioItemId={null} onChanged={vi.fn()} />);
    const captionInputs = await screen.findAllByLabelText("Caption");
    expect(captionInputs).toHaveLength(2);

    const secondCard = captionInputs[1].closest("li") as HTMLElement;
    await user.click(within(secondCard).getByRole("button", { name: "Move up" }));

    expect(vi.mocked(reorderMediaKitGalleryItemsAction)).toHaveBeenCalledWith(null, ["gallery_2", "gallery_1"]);
  });
});
