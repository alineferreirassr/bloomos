import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/script/scriptActions", () => ({
  updateScriptItemAction: vi.fn(),
  archiveScriptItemAction: vi.fn(),
  unarchiveScriptItemAction: vi.fn(),
  createScriptVersionAction: vi.fn(),
  listScriptVersionsAction: vi.fn(),
  listScriptBlocksAction: vi.fn(),
  createScriptBlockAction: vi.fn(),
  updateScriptBlockAction: vi.fn(),
  removeScriptBlockAction: vi.fn(),
}));
vi.mock("@/modules/idea/ideaActions", () => ({
  getIdeaItemAction: vi.fn(),
  listIdeaItemsAction: vi.fn(),
}));
vi.mock("@/modules/aiGeneration/aiGenerationActions", () => ({
  listAIGenerationsAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
  approveAIGenerationAction: vi.fn(),
  rejectAIGenerationAction: vi.fn(),
}));
vi.mock("@/modules/ai/contentIntelligence/analyzeContentAction", () => ({
  analyzeContentAction: vi.fn(),
}));

import {
  updateScriptItemAction,
  archiveScriptItemAction,
  unarchiveScriptItemAction,
  createScriptVersionAction,
  listScriptVersionsAction,
  listScriptBlocksAction,
} from "@/modules/script/scriptActions";
import { getIdeaItemAction, listIdeaItemsAction } from "@/modules/idea/ideaActions";
import { ScriptDetailDialog } from "@/modules/script/components/ScriptDetailDialog";
import type { ScriptItem } from "@/types/scriptItem";
import type { ScriptVersion } from "@/types/scriptVersion";
import type { IdeaItem } from "@/types/ideaItem";

function item(overrides: Partial<ScriptItem> = {}): ScriptItem {
  return {
    id: "script_1",
    workspace_id: "ws_1",
    title: "Spring wedding behind-the-scenes",
    status: "active",
    source_idea_id: null,
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-09-22T00:00:00Z",
    updated_at: "2026-09-22T00:00:00Z",
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
    hook: "The Idea's own hook — never copied onto a Script.",
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

function version(overrides: Partial<ScriptVersion> = {}): ScriptVersion {
  return {
    id: "version_1",
    script_id: "script_1",
    workspace_id: "ws_1",
    status: "draft",
    version_number: null,
    published_at: null,
    published_by: null,
    created_by: "user_1",
    created_at: "2026-09-22T00:00:00Z",
    updated_at: "2026-09-22T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("ScriptDetailDialog", () => {
  it("renders nothing when item is null", () => {
    vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
    render(<ScriptDetailDialog item={null} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the title as an editable field and an Archived badge only when archived", async () => {
    vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
    const { rerender } = render(<ScriptDetailDialog item={item({ archived_at: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(await screen.findByLabelText("Title")).toHaveValue("Spring wedding behind-the-scenes");
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();

    rerender(<ScriptDetailDialog item={item({ archived_at: "2026-09-23T00:00:00Z", status: "archived" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(await screen.findByText("Archived")).toBeInTheDocument();
  });

  it("shows Archive for an active item and Restore for an archived item, only when canManage", async () => {
    vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
    const { rerender } = render(<ScriptDetailDialog item={item({ archived_at: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Archive" })).toBeInTheDocument();

    rerender(<ScriptDetailDialog item={item({ archived_at: "2026-09-23T00:00:00Z" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("hides Archive/Restore/Save entirely for a read-only viewer", async () => {
    vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
    render(<ScriptDetailDialog item={item()} onClose={vi.fn()} canManage={false} onChanged={vi.fn()} />);
    await screen.findByLabelText("Title");
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("disables title editing and hides Save changes for an archived item", async () => {
    vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
    render(<ScriptDetailDialog item={item({ archived_at: "2026-09-23T00:00:00Z", status: "archived" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
    expect(await screen.findByLabelText("Title")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("saves the edited title via updateScriptItemAction and reports the updated item back", async () => {
    vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
    const updated = item({ title: "Updated title" });
    vi.mocked(updateScriptItemAction).mockResolvedValue({ success: true, data: updated });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<ScriptDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={onChanged} />);

    const titleInput = await screen.findByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Updated title");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateScriptItemAction).toHaveBeenCalledWith("script_1", expect.objectContaining({ title: "Updated title" }));
    expect(onChanged).toHaveBeenCalledWith(updated);
  });

  it("calls archiveScriptItemAction and reports the updated item back", async () => {
    vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
    const archived = item({ archived_at: "2026-09-23T00:00:00Z", status: "archived" });
    vi.mocked(archiveScriptItemAction).mockResolvedValue({ success: true, data: archived });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<ScriptDetailDialog item={item({ archived_at: null })} onClose={vi.fn()} canManage onChanged={onChanged} />);

    await user.click(await screen.findByRole("button", { name: "Archive" }));
    expect(archiveScriptItemAction).toHaveBeenCalledWith("script_1");
    expect(onChanged).toHaveBeenCalledWith(archived);
  });

  it("calls unarchiveScriptItemAction from an archived item", async () => {
    vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
    const restored = item({ archived_at: null });
    vi.mocked(unarchiveScriptItemAction).mockResolvedValue({ success: true, data: restored });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<ScriptDetailDialog item={item({ archived_at: "2026-09-23T00:00:00Z" })} onClose={vi.fn()} canManage onChanged={onChanged} />);

    await user.click(await screen.findByRole("button", { name: "Restore" }));
    expect(unarchiveScriptItemAction).toHaveBeenCalledWith("script_1");
    expect(onChanged).toHaveBeenCalledWith(restored);
  });

  it("calls onClose from the Close button", async () => {
    vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ScriptDetailDialog item={item()} onClose={onClose} canManage onChanged={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  describe("source Idea linkage", () => {
    it("shows 'Not linked' and a 'Link Idea' action when there is no source_idea_id", async () => {
      vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
      render(<ScriptDetailDialog item={item({ source_idea_id: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
      expect(await screen.findByText("Not linked")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Link Idea" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Remove reference" })).not.toBeInTheDocument();
    });

    it("resolves and shows the linked Idea's own title, never its own hook/content", async () => {
      vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
      vi.mocked(getIdeaItemAction).mockResolvedValue({ success: true, data: ideaItem() });
      render(<ScriptDetailDialog item={item({ source_idea_id: "idea_1" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      expect(await screen.findByText("A great content idea")).toBeInTheDocument();
      expect(screen.queryByText("The Idea's own hook — never copied onto a Script.")).not.toBeInTheDocument();
    });

    it("opens the picker and lists the workspace's own Ideas by title", async () => {
      vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
      vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [ideaItem(), ideaItem({ id: "idea_2", title: "Second idea" })] });
      const user = userEvent.setup();
      render(<ScriptDetailDialog item={item({ source_idea_id: null })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      await user.click(await screen.findByRole("button", { name: "Link Idea" }));
      expect(await screen.findByRole("button", { name: "A great content idea" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Second idea" })).toBeInTheDocument();
    });

    it("selecting an Idea in the picker and saving sets source_idea_id, without copying its content into the title", async () => {
      vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
      vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [ideaItem({ id: "idea_new", title: "New idea" })] });
      vi.mocked(updateScriptItemAction).mockResolvedValue({ success: true, data: item({ source_idea_id: "idea_new" }) });
      const user = userEvent.setup();
      render(<ScriptDetailDialog item={item({ source_idea_id: null, title: "Original title" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      await user.click(await screen.findByRole("button", { name: "Link Idea" }));
      await user.click(await screen.findByRole("button", { name: "New idea" }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(updateScriptItemAction).toHaveBeenCalledWith("script_1", expect.objectContaining({ source_idea_id: "idea_new" }));
      expect(screen.getByLabelText("Title")).toHaveValue("Original title");
    });

    it("Remove reference clears source_idea_id on save — never deletes the Idea itself", async () => {
      vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
      vi.mocked(getIdeaItemAction).mockResolvedValue({ success: true, data: ideaItem() });
      vi.mocked(updateScriptItemAction).mockResolvedValue({ success: true, data: item({ source_idea_id: null }) });
      const user = userEvent.setup();
      render(<ScriptDetailDialog item={item({ source_idea_id: "idea_1" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      await screen.findByText("A great content idea");
      await user.click(screen.getByRole("button", { name: "Remove reference" }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(updateScriptItemAction).toHaveBeenCalledWith("script_1", expect.objectContaining({ source_idea_id: null }));
    });

    it("hides Link/Change/Remove for a read-only viewer", async () => {
      vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
      render(<ScriptDetailDialog item={item({ source_idea_id: null })} onClose={vi.fn()} canManage={false} onChanged={vi.fn()} />);
      await screen.findByText("Not linked");
      expect(screen.queryByRole("button", { name: "Link Idea" })).not.toBeInTheDocument();
    });
  });

  describe("version / draft management", () => {
    it("shows 'Start Draft' when the Script has no draft version yet", async () => {
      vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
      render(<ScriptDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
      expect(await screen.findByText("This Script has no draft yet.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Start Draft" })).toBeInTheDocument();
    });

    it("hides Start Draft for a read-only viewer", async () => {
      vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
      render(<ScriptDetailDialog item={item()} onClose={vi.fn()} canManage={false} onChanged={vi.fn()} />);
      await screen.findByText("This Script has no draft yet.");
      expect(screen.queryByRole("button", { name: "Start Draft" })).not.toBeInTheDocument();
    });

    it("creates a draft version via createScriptVersionAction and reloads the version list", async () => {
      vi.mocked(listScriptVersionsAction)
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValueOnce({ success: true, data: [version()] });
      vi.mocked(createScriptVersionAction).mockResolvedValue({ success: true, data: version() });
      vi.mocked(listScriptBlocksAction).mockResolvedValue({ success: true, data: [] });
      const user = userEvent.setup();
      render(<ScriptDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      await user.click(await screen.findByRole("button", { name: "Start Draft" }));
      expect(createScriptVersionAction).toHaveBeenCalledWith("script_1");
      expect(await screen.findByText("No blocks yet.")).toBeInTheDocument();
    });

    it("shows the version history with status badges once versions exist", async () => {
      vi.mocked(listScriptVersionsAction).mockResolvedValue({
        success: true,
        data: [version({ id: "v_draft", status: "draft" }), version({ id: "v_published", status: "published", version_number: 1, published_at: "2026-09-24T00:00:00Z" })],
      });
      vi.mocked(listScriptBlocksAction).mockResolvedValue({ success: true, data: [] });
      render(<ScriptDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      expect(await screen.findByText("Draft")).toBeInTheDocument();
      expect(screen.getByText("Published")).toBeInTheDocument();
    });

    it("never shows a publish action — SOCIAL-08D does not implement a publish workflow", async () => {
      vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [version()] });
      vi.mocked(listScriptBlocksAction).mockResolvedValue({ success: true, data: [] });
      render(<ScriptDetailDialog item={item()} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
      await screen.findByText("No blocks yet.");
      expect(screen.queryByRole("button", { name: /publish/i })).not.toBeInTheDocument();
    });

    it("SOCIAL-08E hardening — an older, slower version-list request never overwrites a newer Script's version state after switching quickly", async () => {
      type ListVersionsResult = Awaited<ReturnType<typeof listScriptVersionsAction>>;
      let resolveFirst!: (value: ListVersionsResult) => void;
      const firstRequest = new Promise<ListVersionsResult>((resolve) => {
        resolveFirst = resolve;
      });

      // The stale (first) Script has NO draft — if it were incorrectly
      // applied after switching, the dialog would show "no draft yet"
      // instead of the second Script's own real draft editor.
      vi.mocked(listScriptVersionsAction)
        .mockReturnValueOnce(firstRequest)
        .mockResolvedValueOnce({ success: true, data: [version({ id: "version_2", script_id: "script_2", status: "published", version_number: 1, published_at: "2026-09-20T00:00:00Z", published_by: "user_1" })] });
      vi.mocked(listScriptBlocksAction).mockResolvedValue({ success: true, data: [] });

      const { rerender } = render(<ScriptDetailDialog item={item({ id: "script_1", title: "First script" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);

      // Switch to a different Script before the first request resolves.
      rerender(<ScriptDetailDialog item={item({ id: "script_2", title: "Second script" })} onClose={vi.fn()} canManage onChanged={vi.fn()} />);
      await screen.findByText("This Script has no draft yet.");

      // Now the stale first request resolves with a DRAFT version — if it
      // were wrongly applied, the "no draft" message would flip to the
      // block editor even though this is still Script 2 (which has no
      // draft of its own).
      resolveFirst({ success: true, data: [version({ id: "version_1", script_id: "script_1", status: "draft" })] });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(screen.getByRole("dialog", { name: "Second script" })).toBeInTheDocument();
      expect(screen.getByText("This Script has no draft yet.")).toBeInTheDocument();
      expect(screen.queryByText("No blocks yet.")).not.toBeInTheDocument();
    });
  });
});
