import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/inspiration/inspirationActions", () => ({
  updateInspirationItemAction: vi.fn(),
  listInspirationMediaAssetOptionsAction: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getMediaAssetDownloadUrl: vi.fn(),
}));

import { updateInspirationItemAction, listInspirationMediaAssetOptionsAction } from "@/modules/inspiration/inspirationActions";
import { getMediaAssetDownloadUrl } from "@/lib/data";
import { EditInspirationDialog } from "@/modules/inspiration/components/EditInspirationDialog";
import type { InspirationItem } from "@/types/inspirationItem";
import type { MediaAsset } from "@/types/mediaAsset";

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
    platform_content_id: "reel_abc",
    content_format: "reel",
    hook: "Open on the veil catching the wind.",
    cta: "Book your consult",
    why_it_works: "Motion-first cold open.",
    notes: "Try this for spring 2027.",
    duration_seconds: 45,
    published_at: "2026-08-01T12:00:00Z",
    media_asset_id: null,
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
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

describe("EditInspirationDialog", () => {
  it("renders nothing when item is null", () => {
    render(<EditInspirationDialog item={null} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("seeds every field from the existing item, including null-optional fields as empty", () => {
    render(<EditInspirationDialog item={item()} onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Title")).toHaveValue("Behind the Scenes at a Wedding");
    expect(within(dialog).getByLabelText("Source Type")).toHaveValue("instagram");
    expect(within(dialog).getByLabelText("Source URL (optional)")).toHaveValue("https://instagram.com/reel/abc");
    expect(within(dialog).getByLabelText("Platform Content ID (optional)")).toHaveValue("reel_abc");
    expect(within(dialog).getByLabelText("Creator Name (optional)")).toHaveValue("Jane Doe");
    expect(within(dialog).getByLabelText("Creator Handle (optional)")).toHaveValue("janedoe");
    expect(within(dialog).getByLabelText("Content Format (optional)")).toHaveValue("reel");
    expect(within(dialog).getByLabelText("Hook (optional)")).toHaveValue("Open on the veil catching the wind.");
    expect(within(dialog).getByLabelText("CTA (optional)")).toHaveValue("Book your consult");
    expect(within(dialog).getByLabelText("Why It Works (optional)")).toHaveValue("Motion-first cold open.");
    expect(within(dialog).getByLabelText("Notes (optional)")).toHaveValue("Try this for spring 2027.");
    expect(within(dialog).getByLabelText("Duration in seconds (optional)")).toHaveValue(45);
  });

  it("seeds a null field as an empty control, never a literal 'null' string", () => {
    render(<EditInspirationDialog item={item({ creator_name: null, platform_content_id: null, duration_seconds: null, published_at: null })} onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Creator Name (optional)")).toHaveValue("");
    expect(within(dialog).getByLabelText("Platform Content ID (optional)")).toHaveValue("");
    expect(within(dialog).getByLabelText("Duration in seconds (optional)")).toHaveValue(null);
    expect(within(dialog).getByLabelText("Published date (optional)")).toHaveValue("");
  });

  it("requires a non-empty title before saving", async () => {
    const user = userEvent.setup();
    render(<EditInspirationDialog item={item()} onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Title"));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Title is required.");
    expect(updateInspirationItemAction).not.toHaveBeenCalled();
  });

  it("saves via updateInspirationItemAction only, never a direct repository call, and reports the saved item back", async () => {
    const saved = item({ title: "Updated title" });
    vi.mocked(updateInspirationItemAction).mockResolvedValue({ success: true, data: saved });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<EditInspirationDialog item={item()} onClose={vi.fn()} onSaved={onSaved} />);
    const dialog = screen.getByRole("dialog");

    await user.clear(within(dialog).getByLabelText("Title"));
    await user.type(within(dialog).getByLabelText("Title"), "Updated title");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(updateInspirationItemAction).toHaveBeenCalledWith("insp_1", expect.objectContaining({ title: "Updated title" }));
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("never sends id, workspace_id, normalized_source_url, created_by, created_at, updated_at, or archived_at as editable input", async () => {
    vi.mocked(updateInspirationItemAction).mockResolvedValue({ success: true, data: item() });
    const user = userEvent.setup();
    render(<EditInspirationDialog item={item()} onClose={vi.fn()} onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Save" }));

    const sentInput = vi.mocked(updateInspirationItemAction).mock.calls[0][1] as unknown as Record<string, unknown>;
    for (const forbidden of ["id", "workspace_id", "normalized_source_url", "created_by", "created_at", "updated_at", "archived_at"]) {
      expect(sentInput).not.toHaveProperty(forbidden);
    }
  });

  it("shows a controlled validation error from the server and keeps the dialog open", async () => {
    vi.mocked(updateInspirationItemAction).mockResolvedValue({ success: false, error: "Please fix the highlighted fields." });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EditInspirationDialog item={item()} onClose={onClose} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please fix the highlighted fields.");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a controlled, friendly duplicate error and keeps the dialog open with edits intact", async () => {
    vi.mocked(updateInspirationItemAction).mockResolvedValue({ success: false, error: "This has already been saved to your Inspiration library." });
    const user = userEvent.setup();
    render(<EditInspirationDialog item={item()} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Save" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This has already been saved to your Inspiration library.");
    expect(alert.textContent).not.toMatch(/23505|constraint|postgres/i);
    expect(screen.getByLabelText("Title")).toHaveValue("Behind the Scenes at a Wedding");
  });

  it("does not auto-override the source type on URL edit when the item already had a URL (an existing deliberate choice)", async () => {
    const user = userEvent.setup();
    render(<EditInspirationDialog item={item({ source_type: "instagram", source_url: "https://instagram.com/reel/abc" })} onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole("dialog");

    await user.clear(within(dialog).getByLabelText("Source URL (optional)"));
    await user.type(within(dialog).getByLabelText("Source URL (optional)"), "https://www.tiktok.com/@user/video/1");
    expect(within(dialog).getByLabelText("Source Type")).toHaveValue("instagram");
  });

  it("does suggest a source type when a URL is added to a previously URL-less (manual) item", async () => {
    const user = userEvent.setup();
    render(<EditInspirationDialog item={item({ source_type: "manual", source_url: null })} onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Source URL (optional)"), "https://www.tiktok.com/@user/video/1");
    expect(within(dialog).getByLabelText("Source Type")).toHaveValue("tiktok");
  });

  describe("MediaAsset attachment", () => {
    it("shows no preview and an 'Attach a file' action when there is no MediaAsset", () => {
      render(<EditInspirationDialog item={item({ media_asset_id: null })} onClose={vi.fn()} onSaved={vi.fn()} />);
      expect(screen.getByRole("button", { name: "Attach a file" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Remove attachment" })).not.toBeInTheDocument();
    });

    it("shows a preview and 'Change'/'Remove attachment' actions when a MediaAsset is already attached", async () => {
      vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/a.jpg", expiresAt: "2026-01-01T00:00:00Z" } });
      render(<EditInspirationDialog item={item({ media_asset_id: "asset_1" })} onClose={vi.fn()} onSaved={vi.fn()} />);
      expect(await screen.findByRole("img")).toHaveAttribute("src", "https://signed.example.com/a.jpg");
      expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove attachment" })).toBeInTheDocument();
    });

    it("opens the picker and lists same-workspace assets of any status (pending/approved/rejected/needs_revision) — no publish-approval gate", async () => {
      vi.mocked(listInspirationMediaAssetOptionsAction).mockResolvedValue({
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
      render(<EditInspirationDialog item={item({ media_asset_id: null })} onClose={vi.fn()} onSaved={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: "Attach a file" }));
      expect(await screen.findByRole("button", { name: "pending.jpg" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "approved.jpg" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "rejected.jpg" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "needsrevision.jpg" })).toBeInTheDocument();
      expect(listInspirationMediaAssetOptionsAction).toHaveBeenCalled();
    });

    it("selecting a picker tile attaches that asset and saves it on submit", async () => {
      vi.mocked(listInspirationMediaAssetOptionsAction).mockResolvedValue({ success: true, data: [mediaAsset({ id: "asset_new" })] });
      vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/x.jpg", expiresAt: "2026-01-01T00:00:00Z" } });
      vi.mocked(updateInspirationItemAction).mockResolvedValue({ success: true, data: item({ media_asset_id: "asset_new" }) });
      const user = userEvent.setup();
      render(<EditInspirationDialog item={item({ media_asset_id: null })} onClose={vi.fn()} onSaved={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: "Attach a file" }));
      await user.click(await screen.findByRole("button", { name: "photo.jpg" }));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(updateInspirationItemAction).toHaveBeenCalledWith("insp_1", expect.objectContaining({ media_asset_id: "asset_new" }));
    });

    it("Remove attachment clears the asset and saves media_asset_id as null — never deletes the MediaAsset itself", async () => {
      vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/a.jpg", expiresAt: "2026-01-01T00:00:00Z" } });
      vi.mocked(updateInspirationItemAction).mockResolvedValue({ success: true, data: item({ media_asset_id: null }) });
      const user = userEvent.setup();
      render(<EditInspirationDialog item={item({ media_asset_id: "asset_1" })} onClose={vi.fn()} onSaved={vi.fn()} />);

      await screen.findByRole("img");
      await user.click(screen.getByRole("button", { name: "Remove attachment" }));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(updateInspirationItemAction).toHaveBeenCalledWith("insp_1", expect.objectContaining({ media_asset_id: null }));
    });

    it("falls back gracefully (no broken image) when the signed preview URL cannot be resolved", async () => {
      vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not found" });
      render(<EditInspirationDialog item={item({ media_asset_id: "asset_1" })} onClose={vi.fn()} onSaved={vi.fn()} />);
      await screen.findByRole("button", { name: "Change" });
      expect(document.querySelector("img")).not.toBeInTheDocument();
    });
  });

  it("Cancel calls onClose without saving", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EditInspirationDialog item={item()} onClose={onClose} onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(updateInspirationItemAction).not.toHaveBeenCalled();
  });
});
