import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/carousel/carouselActions", () => ({
  listCarouselSlidesAction: vi.fn(),
  createCarouselSlideAction: vi.fn(),
  updateCarouselSlideAction: vi.fn(),
  removeCarouselSlideAction: vi.fn(),
  listCarouselMediaAssetOptionsAction: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getMediaAssetDownloadUrl: vi.fn(),
}));

import {
  listCarouselSlidesAction,
  createCarouselSlideAction,
  updateCarouselSlideAction,
  removeCarouselSlideAction,
  listCarouselMediaAssetOptionsAction,
} from "@/modules/carousel/carouselActions";
import { getMediaAssetDownloadUrl } from "@/lib/data";
import { CarouselSlideEditor } from "@/modules/carousel/components/CarouselSlideEditor";
import type { CarouselSlide } from "@/types/carouselSlide";
import type { MediaAsset } from "@/types/mediaAsset";

function slide(overrides: Partial<CarouselSlide> = {}): CarouselSlide {
  return {
    id: "slide_1",
    carousel_id: "carousel_1",
    workspace_id: "ws_1",
    content: "Fall in love with fall weddings.",
    sort_order: 0,
    media_asset_id: null,
    created_at: "2026-09-24T00:00:00Z",
    updated_at: "2026-09-24T00:00:00Z",
    ...overrides,
  };
}

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "asset_1",
    workspace_id: "ws_1",
    owner_type: "workspace",
    owner_id: "ws_1",
    original_filename: "photo.jpg",
    stored_filename: "photo_stored.jpg",
    storage_bucket: "media",
    storage_path: "path/photo.jpg",
    mime_type: "image/jpeg",
    extension: "jpg",
    file_size: 1000,
    checksum: "abc",
    width: null,
    height: null,
    duration: null,
    version: 1,
    uploaded_by: "member_1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    folder_id: null,
    tags: [],
    color_label: null,
    priority: null,
    ai_ready: false,
    status: "pending",
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    version_notes: null,
    metadata: { pages: null, author: null, license: null, brand: null, colorProfile: null, cameraData: null, location: null, custom: {} },
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("CarouselSlideEditor — loading / empty / error / populated", () => {
  it("shows a loading state before the fetch resolves", () => {
    vi.mocked(listCarouselSlidesAction).mockReturnValue(new Promise(() => {}));
    render(<CarouselSlideEditor carouselId="carousel_1" canManage />);
    expect(screen.getByText("Loading slides…")).toBeInTheDocument();
  });

  it("shows an empty state with an Add Slide action when there are zero slides and the caller can manage", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
    render(<CarouselSlideEditor carouselId="carousel_1" canManage />);
    expect(await screen.findByText("No slides yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Slide" })).toBeInTheDocument();
  });

  it("hides the Add Slide action for a read-only viewer", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
    render(<CarouselSlideEditor carouselId="carousel_1" canManage={false} />);
    await screen.findByText("No slides yet.");
    expect(screen.queryByRole("button", { name: "Add Slide" })).not.toBeInTheDocument();
  });

  it("renders slides in the order the backend returns them — trusts listCarouselSlidesAction's own sort_order-ascending ordering rather than re-sorting client-side", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({
      success: true,
      data: [slide({ id: "slide_1", content: "First", sort_order: 0 }), slide({ id: "slide_2", content: "Second", sort_order: 1 })],
    });
    render(<CarouselSlideEditor carouselId="carousel_1" canManage />);

    const textareas = await screen.findAllByRole("textbox", { name: "Content" });
    expect(textareas.map((el) => (el as HTMLTextAreaElement).value)).toEqual(["First", "Second"]);
  });

  it("shows a controlled error state with a working retry", async () => {
    vi.mocked(listCarouselSlidesAction)
      .mockResolvedValueOnce({ success: false, error: "Could not load Carousel slides." })
      .mockResolvedValueOnce({ success: true, data: [slide()] });
    const user = userEvent.setup();
    render(<CarouselSlideEditor carouselId="carousel_1" canManage />);

    expect(await screen.findByText("Could not load Carousel slides.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByDisplayValue("Fall in love with fall weddings.")).toBeInTheDocument();
  });
});

describe("CarouselSlideEditor — add / save / remove", () => {
  it("adds a new slide at the next sort_order after the current highest", async () => {
    vi.mocked(listCarouselSlidesAction)
      .mockResolvedValueOnce({ success: true, data: [slide({ sort_order: 3 })] })
      .mockResolvedValueOnce({ success: true, data: [slide({ sort_order: 3 }), slide({ id: "slide_new", content: "", sort_order: 4 })] });
    vi.mocked(createCarouselSlideAction).mockResolvedValue({ success: true, data: slide({ id: "slide_new", content: "", sort_order: 4 }) });
    const user = userEvent.setup();
    render(<CarouselSlideEditor carouselId="carousel_1" canManage />);

    await screen.findByDisplayValue("Fall in love with fall weddings.");
    await user.click(screen.getByRole("button", { name: "Add Slide" }));

    expect(createCarouselSlideAction).toHaveBeenCalledWith("carousel_1", { content: "", sort_order: 4, media_asset_id: null });
  });

  it("disables Add Slide while a create request is in flight, preventing a duplicate sort_order from a double-click", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
    let resolveCreate!: (value: Awaited<ReturnType<typeof createCarouselSlideAction>>) => void;
    vi.mocked(createCarouselSlideAction).mockReturnValue(new Promise((resolve) => (resolveCreate = resolve)));
    const user = userEvent.setup();
    render(<CarouselSlideEditor carouselId="carousel_1" canManage />);

    await screen.findByText("No slides yet.");
    const addButton = screen.getByRole("button", { name: "Add Slide" });
    await user.click(addButton);

    expect(addButton).toBeDisabled();
    expect(createCarouselSlideAction).toHaveBeenCalledTimes(1);

    resolveCreate({ success: true, data: slide({ id: "slide_new", content: "" }) });
    await waitFor(() => expect(addButton).not.toBeDisabled());
  });

  it("saves edited content and position for a slide", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [slide()] });
    vi.mocked(updateCarouselSlideAction).mockResolvedValue({ success: true, data: slide({ content: "Revised line.", sort_order: 2 }) });
    const user = userEvent.setup();
    render(<CarouselSlideEditor carouselId="carousel_1" canManage />);

    const textarea = await screen.findByDisplayValue("Fall in love with fall weddings.");
    await user.clear(textarea);
    await user.type(textarea, "Revised line.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateCarouselSlideAction).toHaveBeenCalledWith("carousel_1", "slide_1", { content: "Revised line.", sort_order: 0, media_asset_id: null });
  });

  it("removes a slide, taking it out of the visible list", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({
      success: true,
      data: [slide({ id: "slide_1", content: "Keep me" }), slide({ id: "slide_2", content: "Remove me", sort_order: 1 })],
    });
    vi.mocked(removeCarouselSlideAction).mockResolvedValue({ success: true, data: null });
    const user = userEvent.setup();
    render(<CarouselSlideEditor carouselId="carousel_1" canManage />);

    await screen.findByDisplayValue("Remove me");
    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    await user.click(removeButtons[1]);

    expect(removeCarouselSlideAction).toHaveBeenCalledWith("carousel_1", "slide_2");
    expect(screen.queryByDisplayValue("Remove me")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Keep me")).toBeInTheDocument();
  });

  it("shows a controlled error and keeps the slide visible when removal fails", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [slide()] });
    vi.mocked(removeCarouselSlideAction).mockResolvedValue({ success: false, error: "This Carousel slide could not be found." });
    const user = userEvent.setup();
    render(<CarouselSlideEditor carouselId="carousel_1" canManage />);

    await screen.findByDisplayValue("Fall in love with fall weddings.");
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This Carousel slide could not be found.");
    expect(screen.getByDisplayValue("Fall in love with fall weddings.")).toBeInTheDocument();
  });

  it("hides Save/Remove/position editing/media picking for a read-only viewer", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [slide()] });
    render(<CarouselSlideEditor carouselId="carousel_1" canManage={false} />);

    await screen.findByDisplayValue("Fall in love with fall weddings.");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Attach a file" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Position")).toBeDisabled();
    expect(screen.getByDisplayValue("Fall in love with fall weddings.")).toBeDisabled();
  });

  it("never renders raw HTML from slide content — plain text only", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [slide({ content: "<img src=x onerror=alert(1)>" })] });
    render(<CarouselSlideEditor carouselId="carousel_1" canManage />);

    const textarea = await screen.findByDisplayValue("<img src=x onerror=alert(1)>");
    expect(within(document.body).queryByRole("img")).not.toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("handles sort_order 0 correctly (?? not ||)", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [slide({ sort_order: 0 })] });
    render(<CarouselSlideEditor carouselId="carousel_1" canManage />);
    expect(await screen.findByLabelText("Position")).toHaveValue(0);
  });
});

describe("CarouselSlideEditor — MediaAsset attachment", () => {
  it("attaches a MediaAsset from the inline picker", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [slide()] });
    vi.mocked(listCarouselMediaAssetOptionsAction).mockResolvedValue({ success: true, data: [asset()] });
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "no preview" });
    vi.mocked(updateCarouselSlideAction).mockResolvedValue({ success: true, data: slide({ media_asset_id: "asset_1" }) });
    const user = userEvent.setup();
    render(<CarouselSlideEditor carouselId="carousel_1" canManage />);

    await screen.findByDisplayValue("Fall in love with fall weddings.");
    await user.click(screen.getByRole("button", { name: "Attach a file" }));

    expect(await screen.findByTitle("photo.jpg")).toBeInTheDocument();
    await user.click(screen.getByTitle("photo.jpg"));

    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove attachment" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(updateCarouselSlideAction).toHaveBeenCalledWith("carousel_1", "slide_1", { content: "Fall in love with fall weddings.", sort_order: 0, media_asset_id: "asset_1" });
  });

  it("shows a 'No files' message when the workspace's Asset Library is empty", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [slide()] });
    vi.mocked(listCarouselMediaAssetOptionsAction).mockResolvedValue({ success: true, data: [] });
    const user = userEvent.setup();
    render(<CarouselSlideEditor carouselId="carousel_1" canManage />);

    await screen.findByDisplayValue("Fall in love with fall weddings.");
    await user.click(screen.getByRole("button", { name: "Attach a file" }));
    expect(await screen.findByText("No files in your Asset Library yet.")).toBeInTheDocument();
  });

  it("removes an attached MediaAsset back to null", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [slide({ media_asset_id: "asset_1" })] });
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "no preview" });
    vi.mocked(updateCarouselSlideAction).mockResolvedValue({ success: true, data: slide({ media_asset_id: null }) });
    const user = userEvent.setup();
    render(<CarouselSlideEditor carouselId="carousel_1" canManage />);

    await screen.findByDisplayValue("Fall in love with fall weddings.");
    await user.click(screen.getByRole("button", { name: "Remove attachment" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateCarouselSlideAction).toHaveBeenCalledWith("carousel_1", "slide_1", expect.objectContaining({ media_asset_id: null }));
  });

  it("a slide with no MediaAsset shows a 'No file' placeholder, never a broken image", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [slide({ media_asset_id: null })] });
    render(<CarouselSlideEditor carouselId="carousel_1" canManage />);
    await screen.findByDisplayValue("Fall in love with fall weddings.");
    expect(screen.getByText("No file")).toBeInTheDocument();
  });
});

describe("CarouselSlideEditor — stale response protection", () => {
  it("a slower, stale response for a previously-viewed carousel never overwrites the newly selected one's slides", async () => {
    type ListResult = Awaited<ReturnType<typeof listCarouselSlidesAction>>;
    let resolveFirst!: (value: ListResult) => void;
    const firstRequest = new Promise<ListResult>((resolve) => (resolveFirst = resolve));
    vi.mocked(listCarouselSlidesAction)
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce({ success: true, data: [slide({ id: "slide_2", carousel_id: "carousel_2", content: "Carousel 2 slide" })] });

    const { rerender } = render(<CarouselSlideEditor carouselId="carousel_1" canManage />);
    rerender(<CarouselSlideEditor carouselId="carousel_2" canManage />);

    await screen.findByDisplayValue("Carousel 2 slide");

    resolveFirst({ success: true, data: [slide({ id: "slide_1", carousel_id: "carousel_1", content: "Stale carousel 1 slide" })] });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByDisplayValue("Carousel 2 slide")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Stale carousel 1 slide")).not.toBeInTheDocument();
  });
});
