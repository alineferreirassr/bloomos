import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/idea/ideaActions", () => ({
  updateIdeaItemAction: vi.fn(),
  listIdeaMediaAssetOptionsAction: vi.fn(),
}));
vi.mock("@/modules/inspiration/inspirationActions", () => ({
  getInspirationItemAction: vi.fn(),
  listInspirationItemsAction: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getMediaAssetDownloadUrl: vi.fn(),
}));

import { updateIdeaItemAction, listIdeaMediaAssetOptionsAction } from "@/modules/idea/ideaActions";
import { getInspirationItemAction, listInspirationItemsAction } from "@/modules/inspiration/inspirationActions";
import { getMediaAssetDownloadUrl } from "@/lib/data";
import { EditIdeaDialog } from "@/modules/idea/components/EditIdeaDialog";
import type { IdeaItem } from "@/types/ideaItem";
import type { InspirationItem } from "@/types/inspirationItem";
import type { MediaAsset } from "@/types/mediaAsset";

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
    audience: "Engaged couples",
    notes: "Try this for spring 2027.",
    media_asset_id: null,
    priority: "high",
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
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
    hook: "Real hook from the reference — never copied onto an Idea.",
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

function mediaAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "asset_1",
    workspace_id: "ws_1",
    owner_type: "workspace",
    owner_id: "ws_1",
    original_filename: "photo.jpg",
    stored_filename: "photo.jpg",
    storage_bucket: "media",
    storage_path: "ws_1/photo.jpg",
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

describe("EditIdeaDialog", () => {
  it("renders nothing when item is null", () => {
    render(<EditIdeaDialog item={null} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("seeds every field from the existing item", () => {
    render(<EditIdeaDialog item={item()} onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Title")).toHaveValue("Behind the scenes at a spring wedding");
    expect(within(dialog).getByLabelText("Description")).toHaveValue("A short reel following setup to first dance.");
    expect(within(dialog).getByLabelText("Content Format (optional)")).toHaveValue("reel");
    expect(within(dialog).getByLabelText("Priority (optional)")).toHaveValue("high");
    expect(within(dialog).getByLabelText("Hook (optional)")).toHaveValue("Open on the veil catching the wind.");
    expect(within(dialog).getByLabelText("CTA (optional)")).toHaveValue("Book your consult");
    expect(within(dialog).getByLabelText("Audience (optional)")).toHaveValue("Engaged couples");
    expect(within(dialog).getByLabelText("Notes (optional)")).toHaveValue("Try this for spring 2027.");
  });

  it("seeds a null field as an empty control, never a literal 'null' string", () => {
    render(
      <EditIdeaDialog item={item({ content_format: null, priority: null, hook: null, cta: null, audience: null, notes: null })} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Content Format (optional)")).toHaveValue("");
    expect(within(dialog).getByLabelText("Priority (optional)")).toHaveValue("");
    expect(within(dialog).getByLabelText("Hook (optional)")).toHaveValue("");
    expect(within(dialog).getByLabelText("CTA (optional)")).toHaveValue("");
    expect(within(dialog).getByLabelText("Audience (optional)")).toHaveValue("");
    expect(within(dialog).getByLabelText("Notes (optional)")).toHaveValue("");
  });

  it("requires a non-empty title before saving", async () => {
    const user = userEvent.setup();
    render(<EditIdeaDialog item={item()} onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Title"));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Title is required.");
    expect(updateIdeaItemAction).not.toHaveBeenCalled();
  });

  it("requires a non-empty description before saving", async () => {
    const user = userEvent.setup();
    render(<EditIdeaDialog item={item()} onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Description"));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Description is required.");
    expect(updateIdeaItemAction).not.toHaveBeenCalled();
  });

  it("saves via updateIdeaItemAction only, and reports the saved item back", async () => {
    const saved = item({ title: "Updated title" });
    vi.mocked(updateIdeaItemAction).mockResolvedValue({ success: true, data: saved });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<EditIdeaDialog item={item()} onClose={vi.fn()} onSaved={onSaved} />);
    const dialog = screen.getByRole("dialog");

    await user.clear(within(dialog).getByLabelText("Title"));
    await user.type(within(dialog).getByLabelText("Title"), "Updated title");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(updateIdeaItemAction).toHaveBeenCalledWith("idea_1", expect.objectContaining({ title: "Updated title" }));
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("never sends id, workspace_id, status, created_by, created_at, updated_at, or archived_at as editable input", async () => {
    vi.mocked(updateIdeaItemAction).mockResolvedValue({ success: true, data: item() });
    const user = userEvent.setup();
    render(<EditIdeaDialog item={item()} onClose={vi.fn()} onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Save" }));

    const sentInput = vi.mocked(updateIdeaItemAction).mock.calls[0][1] as unknown as Record<string, unknown>;
    for (const forbidden of ["id", "workspace_id", "status", "created_by", "created_at", "updated_at", "archived_at"]) {
      expect(sentInput).not.toHaveProperty(forbidden);
    }
  });

  it("shows a controlled error from the server and keeps the dialog open with edits intact", async () => {
    vi.mocked(updateIdeaItemAction).mockResolvedValue({ success: false, error: "An archived Idea cannot be edited — restore it first." });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EditIdeaDialog item={item()} onClose={onClose} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("An archived Idea cannot be edited — restore it first.");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Behind the scenes at a spring wedding");
  });

  it("Cancel calls onClose without saving", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EditIdeaDialog item={item()} onClose={onClose} onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(updateIdeaItemAction).not.toHaveBeenCalled();
  });

  it("stores plain text verbatim — no HTML execution, no dangerouslySetInnerHTML assumptions", async () => {
    const payload = "<img src=x onerror=alert(1)>";
    vi.mocked(updateIdeaItemAction).mockResolvedValue({ success: true, data: item({ notes: payload }) });
    const user = userEvent.setup();
    render(<EditIdeaDialog item={item()} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.clear(screen.getByLabelText("Notes (optional)"));
    await user.type(screen.getByLabelText("Notes (optional)"), payload);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateIdeaItemAction).toHaveBeenCalledWith("idea_1", expect.objectContaining({ notes: payload }));
    expect(document.querySelector("img")).not.toBeInTheDocument();
  });

  describe("Inspiration linkage", () => {
    it("shows 'Not linked' and a 'Link Inspiration' action when there is no source_inspiration_id", () => {
      render(<EditIdeaDialog item={item({ source_inspiration_id: null })} onClose={vi.fn()} onSaved={vi.fn()} />);
      expect(screen.getByText("Not linked")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Link Inspiration" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Remove reference" })).not.toBeInTheDocument();
    });

    it("resolves and shows the linked Inspiration's own title, and offers Change/Remove reference", async () => {
      vi.mocked(getInspirationItemAction).mockResolvedValue({ success: true, data: inspirationItem() });
      render(<EditIdeaDialog item={item({ source_inspiration_id: "insp_1" })} onClose={vi.fn()} onSaved={vi.fn()} />);

      expect(await screen.findByText("Studio tour reel")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove reference" })).toBeInTheDocument();
    });

    it("opens the picker and lists the workspace's own Inspirations by title", async () => {
      vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: true, data: [inspirationItem(), inspirationItem({ id: "insp_2", title: "Second reference" })] });
      const user = userEvent.setup();
      render(<EditIdeaDialog item={item({ source_inspiration_id: null })} onClose={vi.fn()} onSaved={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: "Link Inspiration" }));
      expect(await screen.findByRole("button", { name: "Studio tour reel" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Second reference" })).toBeInTheDocument();
      expect(listInspirationItemsAction).toHaveBeenCalled();
    });

    it("selecting an Inspiration in the picker sets source_inspiration_id and saves it, without copying its hook/content", async () => {
      vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: true, data: [inspirationItem({ id: "insp_new", title: "New reference" })] });
      vi.mocked(updateIdeaItemAction).mockResolvedValue({ success: true, data: item({ source_inspiration_id: "insp_new" }) });
      const user = userEvent.setup();
      render(<EditIdeaDialog item={item({ source_inspiration_id: null, hook: "Original idea hook" })} onClose={vi.fn()} onSaved={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: "Link Inspiration" }));
      await user.click(await screen.findByRole("button", { name: "New reference" }));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(updateIdeaItemAction).toHaveBeenCalledWith("idea_1", expect.objectContaining({ source_inspiration_id: "insp_new" }));
      // The Idea's own hook is untouched — the picker never overwrites any field but the reference itself.
      expect(screen.getByLabelText("Hook (optional)")).toHaveValue("Original idea hook");
    });

    it("Remove reference clears source_inspiration_id and saves it as null — never deletes the Inspiration itself", async () => {
      vi.mocked(getInspirationItemAction).mockResolvedValue({ success: true, data: inspirationItem() });
      vi.mocked(updateIdeaItemAction).mockResolvedValue({ success: true, data: item({ source_inspiration_id: null }) });
      const user = userEvent.setup();
      render(<EditIdeaDialog item={item({ source_inspiration_id: "insp_1" })} onClose={vi.fn()} onSaved={vi.fn()} />);

      await screen.findByText("Studio tour reel");
      await user.click(screen.getByRole("button", { name: "Remove reference" }));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(updateIdeaItemAction).toHaveBeenCalledWith("idea_1", expect.objectContaining({ source_inspiration_id: null }));
    });

    it("shows a controlled message when the Inspiration list fails to load", async () => {
      vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: false, error: "Could not load Inspiration items." });
      const user = userEvent.setup();
      render(<EditIdeaDialog item={item({ source_inspiration_id: null })} onClose={vi.fn()} onSaved={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: "Link Inspiration" }));
      expect(await screen.findByText("Could not load Inspiration items.")).toBeInTheDocument();
    });
  });

  describe("MediaAsset attachment", () => {
    it("shows no preview and an 'Attach a file' action when there is no MediaAsset", () => {
      render(<EditIdeaDialog item={item({ media_asset_id: null })} onClose={vi.fn()} onSaved={vi.fn()} />);
      expect(screen.getByRole("button", { name: "Attach a file" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Remove attachment" })).not.toBeInTheDocument();
    });

    it("shows a preview and 'Change'/'Remove attachment' actions when a MediaAsset is already attached", async () => {
      vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/a.jpg", expiresAt: "2026-01-01T00:00:00Z" } });
      render(<EditIdeaDialog item={item({ media_asset_id: "asset_1" })} onClose={vi.fn()} onSaved={vi.fn()} />);
      expect(await screen.findByRole("img")).toHaveAttribute("src", "https://signed.example.com/a.jpg");
      expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove attachment" })).toBeInTheDocument();
    });

    it("opens the picker and lists same-workspace assets of any status (pending/approved/rejected/needs_revision) — no publish-approval gate", async () => {
      vi.mocked(listIdeaMediaAssetOptionsAction).mockResolvedValue({
        success: true,
        data: [
          mediaAsset({ id: "a_pending", status: "pending", original_filename: "pending.jpg" }),
          mediaAsset({ id: "a_approved", status: "approved", original_filename: "approved.jpg" }),
          mediaAsset({ id: "a_rejected", status: "rejected", original_filename: "rejected.jpg" }),
          mediaAsset({ id: "a_needs_revision", status: "needs_revision", original_filename: "needsrevision.jpg" }),
        ],
      });
      vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/x.jpg", expiresAt: "2026-01-01T00:00:00Z" } });
      const user = userEvent.setup();
      render(<EditIdeaDialog item={item({ media_asset_id: null })} onClose={vi.fn()} onSaved={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: "Attach a file" }));
      expect(await screen.findByRole("button", { name: "pending.jpg" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "approved.jpg" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "rejected.jpg" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "needsrevision.jpg" })).toBeInTheDocument();
      expect(listIdeaMediaAssetOptionsAction).toHaveBeenCalled();
    });

    it("selecting a picker tile attaches that asset and saves it on submit", async () => {
      vi.mocked(listIdeaMediaAssetOptionsAction).mockResolvedValue({ success: true, data: [mediaAsset({ id: "asset_new" })] });
      vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/x.jpg", expiresAt: "2026-01-01T00:00:00Z" } });
      vi.mocked(updateIdeaItemAction).mockResolvedValue({ success: true, data: item({ media_asset_id: "asset_new" }) });
      const user = userEvent.setup();
      render(<EditIdeaDialog item={item({ media_asset_id: null })} onClose={vi.fn()} onSaved={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: "Attach a file" }));
      await user.click(await screen.findByRole("button", { name: "photo.jpg" }));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(updateIdeaItemAction).toHaveBeenCalledWith("idea_1", expect.objectContaining({ media_asset_id: "asset_new" }));
    });

    it("replacing an already-attached asset overwrites media_asset_id with the newly picked one", async () => {
      vi.mocked(listIdeaMediaAssetOptionsAction).mockResolvedValue({ success: true, data: [mediaAsset({ id: "asset_replacement", original_filename: "replacement.jpg" })] });
      vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/a.jpg", expiresAt: "2026-01-01T00:00:00Z" } });
      vi.mocked(updateIdeaItemAction).mockResolvedValue({ success: true, data: item({ media_asset_id: "asset_replacement" }) });
      const user = userEvent.setup();
      render(<EditIdeaDialog item={item({ media_asset_id: "asset_1" })} onClose={vi.fn()} onSaved={vi.fn()} />);

      await screen.findByRole("img");
      await user.click(screen.getByRole("button", { name: "Change" }));
      await user.click(await screen.findByRole("button", { name: "replacement.jpg" }));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(updateIdeaItemAction).toHaveBeenCalledWith("idea_1", expect.objectContaining({ media_asset_id: "asset_replacement" }));
    });

    it("Remove attachment clears the asset and saves media_asset_id as null — never deletes the MediaAsset itself", async () => {
      vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/a.jpg", expiresAt: "2026-01-01T00:00:00Z" } });
      vi.mocked(updateIdeaItemAction).mockResolvedValue({ success: true, data: item({ media_asset_id: null }) });
      const user = userEvent.setup();
      render(<EditIdeaDialog item={item({ media_asset_id: "asset_1" })} onClose={vi.fn()} onSaved={vi.fn()} />);

      await screen.findByRole("img");
      await user.click(screen.getByRole("button", { name: "Remove attachment" }));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(updateIdeaItemAction).toHaveBeenCalledWith("idea_1", expect.objectContaining({ media_asset_id: null }));
    });

    it("falls back gracefully (no broken image) when the signed preview URL cannot be resolved", async () => {
      vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not found" });
      render(<EditIdeaDialog item={item({ media_asset_id: "asset_1" })} onClose={vi.fn()} onSaved={vi.fn()} />);
      await screen.findByRole("button", { name: "Change" });
      expect(document.querySelector("img")).not.toBeInTheDocument();
    });
  });
});
