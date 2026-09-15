import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/carousel/carouselActions", () => ({
  updateCarouselItemAction: vi.fn(),
  archiveCarouselItemAction: vi.fn(),
  unarchiveCarouselItemAction: vi.fn(),
  listCarouselSlidesAction: vi.fn(),
  createCarouselSlideAction: vi.fn(),
  updateCarouselSlideAction: vi.fn(),
  removeCarouselSlideAction: vi.fn(),
  listCarouselMediaAssetOptionsAction: vi.fn(),
}));
vi.mock("@/modules/idea/ideaActions", () => ({
  getIdeaItemAction: vi.fn(),
  listIdeaItemsAction: vi.fn(),
}));

import {
  updateCarouselItemAction,
  archiveCarouselItemAction,
  unarchiveCarouselItemAction,
  listCarouselSlidesAction,
} from "@/modules/carousel/carouselActions";
import { getIdeaItemAction, listIdeaItemsAction } from "@/modules/idea/ideaActions";
import { CarouselDetailDialog } from "@/modules/carousel/components/CarouselDetailDialog";
import type { CarouselItem } from "@/types/carouselItem";
import type { CarouselSlide } from "@/types/carouselSlide";
import type { IdeaItem } from "@/types/ideaItem";

function item(overrides: Partial<CarouselItem> = {}): CarouselItem {
  return {
    id: "carousel_1",
    workspace_id: "ws_1",
    title: "Autumn wedding carousel",
    status: "active",
    source_idea_id: null,
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-09-24T00:00:00Z",
    updated_at: "2026-09-24T00:00:00Z",
    ...overrides,
  };
}

function ideaItem(overrides: Partial<IdeaItem> = {}): IdeaItem {
  return {
    id: "idea_1",
    workspace_id: "ws_1",
    title: "A great content idea",
    description: "A concept for future content.",
    status: "active",
    source_inspiration_id: null,
    content_format: null,
    hook: "The Idea's own hook — never copied onto a Carousel.",
    cta: null,
    audience: null,
    notes: null,
    media_asset_id: null,
    priority: null,
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function slide(overrides: Partial<CarouselSlide> = {}): CarouselSlide {
  return {
    id: "slide_1",
    carousel_id: "carousel_1",
    workspace_id: "ws_1",
    content: "First slide",
    sort_order: 0,
    media_asset_id: null,
    created_at: "2026-09-24T00:00:00Z",
    updated_at: "2026-09-24T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("CarouselDetailDialog", () => {
  it("renders nothing when item is null", () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
    render(<CarouselDetailDialog item={null} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the title as an editable field and an Archived badge only when archived", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
    const { rerender } = render(<CarouselDetailDialog item={item({ archived_at: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(await screen.findByLabelText("Title")).toHaveValue("Autumn wedding carousel");
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();

    rerender(<CarouselDetailDialog item={item({ archived_at: "2026-09-24T00:00:00Z", status: "archived" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(await screen.findByText("Archived")).toBeInTheDocument();
  });

  it("shows Archive for an active item and Restore for an archived item, only when canManage", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
    const { rerender } = render(<CarouselDetailDialog item={item({ archived_at: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Archive" })).toBeInTheDocument();

    rerender(<CarouselDetailDialog item={item({ archived_at: "2026-09-24T00:00:00Z" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("hides Archive/Restore/Save entirely for a read-only viewer", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
    render(<CarouselDetailDialog item={item()} onClose={vi.fn()} canManage={false} onChanged={vi.fn()} />);
    await screen.findByLabelText("Title");
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("disables title editing and hides Save changes for an archived item", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
    render(<CarouselDetailDialog item={item({ archived_at: "2026-09-24T00:00:00Z", status: "archived" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(await screen.findByLabelText("Title")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("saves the edited title via updateCarouselItemAction and reports the updated item back", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
    const updated = item({ title: "Updated title" });
    vi.mocked(updateCarouselItemAction).mockResolvedValue({ success: true, data: updated });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<CarouselDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={onChanged} />);

    const titleInput = await screen.findByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Updated title");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateCarouselItemAction).toHaveBeenCalledWith("carousel_1", expect.objectContaining({ title: "Updated title" }));
    expect(onChanged).toHaveBeenCalledWith(updated);
  });

  it("blocks saving an empty title with a controlled error, never calling the action", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
    const user = userEvent.setup();
    render(<CarouselDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

    const titleInput = await screen.findByLabelText("Title");
    await user.clear(titleInput);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Title is required.");
    expect(updateCarouselItemAction).not.toHaveBeenCalled();
  });

  it("calls archiveCarouselItemAction and reports the updated item back", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
    const archived = item({ archived_at: "2026-09-24T00:00:00Z", status: "archived" });
    vi.mocked(archiveCarouselItemAction).mockResolvedValue({ success: true, data: archived });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<CarouselDetailDialog item={item({ archived_at: null })} onClose={vi.fn()} canManage onChanged={onChanged} />);

    await user.click(await screen.findByRole("button", { name: "Archive" }));
    expect(archiveCarouselItemAction).toHaveBeenCalledWith("carousel_1");
    expect(onChanged).toHaveBeenCalledWith(archived);
  });

  it("calls unarchiveCarouselItemAction from an archived item", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
    const restored = item({ archived_at: null });
    vi.mocked(unarchiveCarouselItemAction).mockResolvedValue({ success: true, data: restored });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<CarouselDetailDialog item={item({ archived_at: "2026-09-24T00:00:00Z" })} onClose={vi.fn()} canManage onChanged={onChanged} />);

    await user.click(await screen.findByRole("button", { name: "Restore" }));
    expect(unarchiveCarouselItemAction).toHaveBeenCalledWith("carousel_1");
    expect(onChanged).toHaveBeenCalledWith(restored);
  });

  it("calls onClose from the Close button", async () => {
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CarouselDetailDialog item={item()} onClose={onClose} canManage onChanged={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  describe("source Idea linkage", () => {
    it("shows 'Not linked' and a 'Link Idea' action when there is no source_idea_id", async () => {
      vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
      render(<CarouselDetailDialog item={item({ source_idea_id: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
      expect(await screen.findByText("Not linked")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Link Idea" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Remove reference" })).not.toBeInTheDocument();
    });

    it("resolves and shows the linked Idea's own title, never its own hook/content", async () => {
      vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
      vi.mocked(getIdeaItemAction).mockResolvedValue({ success: true, data: ideaItem() });
      render(<CarouselDetailDialog item={item({ source_idea_id: "idea_1" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      expect(await screen.findByText("A great content idea")).toBeInTheDocument();
      expect(screen.queryByText("The Idea's own hook — never copied onto a Carousel.")).not.toBeInTheDocument();
    });

    it("opens the picker and lists the workspace's own Ideas by title", async () => {
      vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
      vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [ideaItem(), ideaItem({ id: "idea_2", title: "Second idea" })] });
      const user = userEvent.setup();
      render(<CarouselDetailDialog item={item({ source_idea_id: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      await user.click(await screen.findByRole("button", { name: "Link Idea" }));
      expect(await screen.findByRole("button", { name: "A great content idea" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Second idea" })).toBeInTheDocument();
    });

    it("selecting an Idea in the picker and saving sets source_idea_id, without copying its content into the title", async () => {
      vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
      vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [ideaItem({ id: "idea_new", title: "New idea" })] });
      vi.mocked(updateCarouselItemAction).mockResolvedValue({ success: true, data: item({ source_idea_id: "idea_new" }) });
      const user = userEvent.setup();
      render(<CarouselDetailDialog item={item({ source_idea_id: null, title: "Original title" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      await user.click(await screen.findByRole("button", { name: "Link Idea" }));
      await user.click(await screen.findByRole("button", { name: "New idea" }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(updateCarouselItemAction).toHaveBeenCalledWith("carousel_1", expect.objectContaining({ source_idea_id: "idea_new" }));
      expect(screen.getByLabelText("Title")).toHaveValue("Original title");
    });

    it("Remove reference clears source_idea_id on save — never deletes the Idea itself", async () => {
      vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
      vi.mocked(getIdeaItemAction).mockResolvedValue({ success: true, data: ideaItem() });
      vi.mocked(updateCarouselItemAction).mockResolvedValue({ success: true, data: item({ source_idea_id: null }) });
      const user = userEvent.setup();
      render(<CarouselDetailDialog item={item({ source_idea_id: "idea_1" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      await screen.findByText("A great content idea");
      await user.click(screen.getByRole("button", { name: "Remove reference" }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(updateCarouselItemAction).toHaveBeenCalledWith("carousel_1", expect.objectContaining({ source_idea_id: null }));
    });

    it("hides Link/Change/Remove for a read-only viewer", async () => {
      vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
      render(<CarouselDetailDialog item={item({ source_idea_id: null })} onClose={vi.fn()} canManage={false} onChanged={vi.fn()} />);
      await screen.findByText("Not linked");
      expect(screen.queryByRole("button", { name: "Link Idea" })).not.toBeInTheDocument();
    });

    it("hides Link/Change/Remove for an archived item, even when canManage", async () => {
      vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
      render(<CarouselDetailDialog item={item({ source_idea_id: null, archived_at: "2026-09-24T00:00:00Z" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
      await screen.findByText("Not linked");
      expect(screen.queryByRole("button", { name: "Link Idea" })).not.toBeInTheDocument();
    });
  });

  describe("embedded slide editor — no draft/version gate", () => {
    it("always renders the Slides section directly, with no 'Start Draft' step", async () => {
      vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [slide()] });
      render(<CarouselDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      expect(await screen.findByText("Slides")).toBeInTheDocument();
      expect(listCarouselSlidesAction).toHaveBeenCalledWith("carousel_1");
      expect(screen.queryByRole("button", { name: /start draft/i })).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("First slide")).toBeInTheDocument();
    });

    it("passes canManage=false into the slide editor for an archived item, even when the dialog itself is canManage", async () => {
      vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [slide()] });
      render(<CarouselDetailDialog item={item({ archived_at: "2026-09-24T00:00:00Z", status: "archived" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      await screen.findByDisplayValue("First slide");
      expect(screen.queryByRole("button", { name: "Add Slide" })).not.toBeInTheDocument();
    });

    it("SOCIAL-10E hardening — an older, slower slide-list request for a previous Carousel never overwrites the newly-selected Carousel's slides", async () => {
      type ListSlidesResult = Awaited<ReturnType<typeof listCarouselSlidesAction>>;
      let resolveFirst!: (value: ListSlidesResult) => void;
      const firstRequest = new Promise<ListSlidesResult>((resolve) => {
        resolveFirst = resolve;
      });

      vi.mocked(listCarouselSlidesAction)
        .mockReturnValueOnce(firstRequest)
        .mockResolvedValueOnce({ success: true, data: [slide({ id: "slide_2", carousel_id: "carousel_2", content: "Second carousel's slide" })] });

      const { rerender } = render(<CarouselDetailDialog item={item({ id: "carousel_1", title: "First carousel" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
      rerender(<CarouselDetailDialog item={item({ id: "carousel_2", title: "Second carousel" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      await screen.findByDisplayValue("Second carousel's slide");

      resolveFirst({ success: true, data: [slide({ id: "slide_1", carousel_id: "carousel_1", content: "Stale first carousel slide" })] });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(screen.getByDisplayValue("Second carousel's slide")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("Stale first carousel slide")).not.toBeInTheDocument();
    });
  });
});
