import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MediaKitPortfolioEditor } from "@/modules/mediaKit/components/MediaKitPortfolioEditor";
import type { MediaKitPortfolioItem } from "@/types/mediaKit";

vi.mock("@/lib/data", () => ({ getMediaAssetDownloadUrl: vi.fn(() => new Promise(() => {})), listMediaAssetsForWorkspace: vi.fn(async () => []) }));
vi.mock("@/modules/mediaKit/getMediaKitPortfolioItemsData", () => ({ getMediaKitPortfolioItemsData: vi.fn() }));
vi.mock("@/modules/mediaKit/createMediaKitPortfolioItemAction", () => ({ createMediaKitPortfolioItemAction: vi.fn() }));
vi.mock("@/modules/mediaKit/updateMediaKitPortfolioItemAction", () => ({ updateMediaKitPortfolioItemAction: vi.fn() }));
vi.mock("@/modules/mediaKit/archiveMediaKitPortfolioItemAction", () => ({ archiveMediaKitPortfolioItemAction: vi.fn() }));
vi.mock("@/modules/mediaKit/reorderMediaKitPortfolioItemsAction", () => ({ reorderMediaKitPortfolioItemsAction: vi.fn() }));
vi.mock("@/modules/mediaKit/getMediaKitEventOptionsData", () => ({ getMediaKitEventOptionsData: vi.fn(async () => ({ success: true, data: [{ id: "event_1", title: "The Harrington Wedding", eventDate: "2025-06-01" }] })) }));
vi.mock("@/modules/mediaKit/getMediaKitGalleryItemsData", () => ({ getMediaKitGalleryItemsData: vi.fn(async () => ({ success: true, data: [] })) }));
vi.mock("@/modules/mediaKit/addMediaKitGalleryItemAction", () => ({ addMediaKitGalleryItemAction: vi.fn() }));
vi.mock("@/modules/mediaKit/updateMediaKitGalleryItemAction", () => ({ updateMediaKitGalleryItemAction: vi.fn() }));
vi.mock("@/modules/mediaKit/archiveMediaKitGalleryItemAction", () => ({ archiveMediaKitGalleryItemAction: vi.fn() }));
vi.mock("@/modules/mediaKit/reorderMediaKitGalleryItemsAction", () => ({ reorderMediaKitGalleryItemsAction: vi.fn() }));

import { getMediaKitPortfolioItemsData } from "@/modules/mediaKit/getMediaKitPortfolioItemsData";
import { createMediaKitPortfolioItemAction } from "@/modules/mediaKit/createMediaKitPortfolioItemAction";
import { updateMediaKitPortfolioItemAction } from "@/modules/mediaKit/updateMediaKitPortfolioItemAction";
import { reorderMediaKitPortfolioItemsAction } from "@/modules/mediaKit/reorderMediaKitPortfolioItemsAction";

function makeItem(overrides: Partial<MediaKitPortfolioItem> = {}): MediaKitPortfolioItem {
  return {
    id: "portfolio_1",
    workspace_id: "workspace_1",
    media_kit_id: "mk_1",
    event_id: null,
    title: "Editorial Garden Shoot",
    category: "Editorial",
    location_label: "Savannah, GA",
    event_year: 2025,
    short_description: "A garden celebration.",
    cover_media_asset_id: null,
    is_featured: false,
    is_included: true,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

describe("MediaKitPortfolioEditor", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays existing portfolio items", async () => {
    vi.mocked(getMediaKitPortfolioItemsData).mockResolvedValue({ success: true, data: [makeItem()] });
    render(<MediaKitPortfolioEditor workspaceId="workspace_1" onChanged={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Editorial Garden Shoot" })).toBeInTheDocument();
    expect(screen.getByText(/Editorial · Savannah, GA · 2025/)).toBeInTheDocument();
  });

  it("shows the empty state with an Add Portfolio Item action when there are none yet", async () => {
    vi.mocked(getMediaKitPortfolioItemsData).mockResolvedValue({ success: true, data: [] });
    render(<MediaKitPortfolioEditor workspaceId="workspace_1" onChanged={vi.fn()} />);
    expect(await screen.findByText("No portfolio items yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Portfolio Item" })).toBeInTheDocument();
  });

  it("creating a standalone item (no linked Event) calls the create action with event_id null", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    vi.mocked(getMediaKitPortfolioItemsData).mockResolvedValueOnce({ success: true, data: [] });
    vi.mocked(createMediaKitPortfolioItemAction).mockResolvedValue({ success: true, data: makeItem() });
    vi.mocked(getMediaKitPortfolioItemsData).mockResolvedValueOnce({ success: true, data: [makeItem()] });

    render(<MediaKitPortfolioEditor workspaceId="workspace_1" onChanged={onChanged} />);
    await user.click(await screen.findByRole("button", { name: "Add Portfolio Item" }));
    await user.type(screen.getByLabelText(/^Title/), "Styled Shoot");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(vi.mocked(createMediaKitPortfolioItemAction)).toHaveBeenCalledWith(expect.objectContaining({ title: "Styled Shoot", event_id: null }));
    expect(onChanged).toHaveBeenCalled();
  });

  it("creating an item linked to an existing Event sends the real event_id — never duplicates the Event", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaKitPortfolioItemsData).mockResolvedValue({ success: true, data: [] });
    vi.mocked(createMediaKitPortfolioItemAction).mockResolvedValue({ success: true, data: makeItem({ event_id: "event_1" }) });

    render(<MediaKitPortfolioEditor workspaceId="workspace_1" onChanged={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Add Portfolio Item" }));
    await user.type(screen.getByLabelText(/^Title/), "The Harrington Wedding");
    await user.selectOptions(await screen.findByLabelText("Linked Event"), "event_1");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(vi.mocked(createMediaKitPortfolioItemAction)).toHaveBeenCalledWith(expect.objectContaining({ event_id: "event_1" }));
  });

  it("editing an existing item saves the updated fields", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaKitPortfolioItemsData).mockResolvedValue({ success: true, data: [makeItem()] });
    vi.mocked(updateMediaKitPortfolioItemAction).mockResolvedValue({ success: true, data: makeItem({ title: "Updated Title" }) });

    render(<MediaKitPortfolioEditor workspaceId="workspace_1" onChanged={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Edit presentation" }));
    const titleInput = screen.getByLabelText(/^Title/);
    await user.clear(titleInput);
    await user.type(titleInput, "Updated Title");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(vi.mocked(updateMediaKitPortfolioItemAction)).toHaveBeenCalledWith("portfolio_1", expect.objectContaining({ title: "Updated Title" }));
  });

  it("include/exclude toggles is_included, preserving other fields", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaKitPortfolioItemsData).mockResolvedValue({ success: true, data: [makeItem({ is_included: true })] });
    vi.mocked(updateMediaKitPortfolioItemAction).mockResolvedValue({ success: true, data: makeItem({ is_included: false }) });

    render(<MediaKitPortfolioEditor workspaceId="workspace_1" onChanged={vi.fn()} />);
    const includedCheckboxes = await screen.findAllByRole("checkbox", { name: "Included" });
    await user.click(includedCheckboxes[0]);

    expect(vi.mocked(updateMediaKitPortfolioItemAction)).toHaveBeenCalledWith("portfolio_1", expect.objectContaining({ is_included: false, title: "Editorial Garden Shoot" }));
  });

  it("featured toggle calls the update action", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaKitPortfolioItemsData).mockResolvedValue({ success: true, data: [makeItem({ is_featured: false })] });
    vi.mocked(updateMediaKitPortfolioItemAction).mockResolvedValue({ success: true, data: makeItem({ is_featured: true }) });

    render(<MediaKitPortfolioEditor workspaceId="workspace_1" onChanged={vi.fn()} />);
    const featuredCheckboxes = await screen.findAllByRole("checkbox", { name: "Featured" });
    await user.click(featuredCheckboxes[0]);

    expect(vi.mocked(updateMediaKitPortfolioItemAction)).toHaveBeenCalledWith("portfolio_1", expect.objectContaining({ is_featured: true }));
  });

  it("ordering: Move up/down sends the full reordered id array", async () => {
    const user = userEvent.setup();
    const first = makeItem({ id: "portfolio_1", title: "First", sort_order: 0 });
    const second = makeItem({ id: "portfolio_2", title: "Second", sort_order: 1 });
    vi.mocked(getMediaKitPortfolioItemsData).mockResolvedValue({ success: true, data: [first, second] });
    vi.mocked(reorderMediaKitPortfolioItemsAction).mockResolvedValue({ success: true, data: [] });

    render(<MediaKitPortfolioEditor workspaceId="workspace_1" onChanged={vi.fn()} />);
    await screen.findByRole("heading", { name: "Second" });
    const secondCard = screen.getByRole("heading", { name: "Second" }).closest("li") as HTMLElement;
    await user.click(within(secondCard).getByRole("button", { name: "Move up" }));

    expect(vi.mocked(reorderMediaKitPortfolioItemsAction)).toHaveBeenCalledWith(["portfolio_2", "portfolio_1"]);
  });
});
