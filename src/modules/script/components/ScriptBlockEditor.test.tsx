import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/script/scriptActions", () => ({
  listScriptBlocksAction: vi.fn(),
  createScriptBlockAction: vi.fn(),
  updateScriptBlockAction: vi.fn(),
  removeScriptBlockAction: vi.fn(),
}));

import { listScriptBlocksAction, createScriptBlockAction, updateScriptBlockAction, removeScriptBlockAction } from "@/modules/script/scriptActions";
import { ScriptBlockEditor } from "@/modules/script/components/ScriptBlockEditor";
import type { ScriptBlock } from "@/types/scriptBlock";

function block(overrides: Partial<ScriptBlock> = {}): ScriptBlock {
  return {
    id: "block_1",
    script_version_id: "version_1",
    workspace_id: "ws_1",
    content: "Open on a wide shot of the venue.",
    sort_order: 0,
    created_at: "2026-09-22T00:00:00Z",
    updated_at: "2026-09-22T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("ScriptBlockEditor — loading / empty / error / populated", () => {
  it("shows a loading state before the fetch resolves", () => {
    vi.mocked(listScriptBlocksAction).mockReturnValue(new Promise(() => {}));
    render(<ScriptBlockEditor scriptVersionId="version_1" canManage />);
    expect(screen.getByText("Loading blocks…")).toBeInTheDocument();
  });

  it("shows an empty state with an Add Block action when there are zero blocks and the caller can manage", async () => {
    vi.mocked(listScriptBlocksAction).mockResolvedValue({ success: true, data: [] });
    render(<ScriptBlockEditor scriptVersionId="version_1" canManage />);
    expect(await screen.findByText("No blocks yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Block" })).toBeInTheDocument();
  });

  it("hides the Add Block action for a read-only viewer", async () => {
    vi.mocked(listScriptBlocksAction).mockResolvedValue({ success: true, data: [] });
    render(<ScriptBlockEditor scriptVersionId="version_1" canManage={false} />);
    await screen.findByText("No blocks yet.");
    expect(screen.queryByRole("button", { name: "Add Block" })).not.toBeInTheDocument();
  });

  it("renders blocks in the order the backend returns them — trusts listScriptBlocksAction's own sort_order-ascending ordering rather than re-sorting client-side", async () => {
    vi.mocked(listScriptBlocksAction).mockResolvedValue({
      success: true,
      data: [block({ id: "block_1", content: "First", sort_order: 0 }), block({ id: "block_2", content: "Second", sort_order: 1 })],
    });
    render(<ScriptBlockEditor scriptVersionId="version_1" canManage />);

    const textareas = await screen.findAllByRole("textbox");
    expect(textareas.map((el) => (el as HTMLTextAreaElement).value)).toEqual(["First", "Second"]);
  });

  it("shows a controlled error state with a working retry", async () => {
    vi.mocked(listScriptBlocksAction)
      .mockResolvedValueOnce({ success: false, error: "Could not load Script blocks." })
      .mockResolvedValueOnce({ success: true, data: [block()] });
    const user = userEvent.setup();
    render(<ScriptBlockEditor scriptVersionId="version_1" canManage />);

    expect(await screen.findByText("Could not load Script blocks.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByDisplayValue("Open on a wide shot of the venue.")).toBeInTheDocument();
  });
});

describe("ScriptBlockEditor — add / save / remove", () => {
  it("adds a new block at the next sort_order after the current highest", async () => {
    vi.mocked(listScriptBlocksAction)
      .mockResolvedValueOnce({ success: true, data: [block({ sort_order: 3 })] })
      .mockResolvedValueOnce({ success: true, data: [block({ sort_order: 3 }), block({ id: "block_new", content: "", sort_order: 4 })] });
    vi.mocked(createScriptBlockAction).mockResolvedValue({ success: true, data: block({ id: "block_new", content: "", sort_order: 4 }) });
    const user = userEvent.setup();
    render(<ScriptBlockEditor scriptVersionId="version_1" canManage />);

    await screen.findByDisplayValue("Open on a wide shot of the venue.");
    await user.click(screen.getByRole("button", { name: "Add Block" }));

    expect(createScriptBlockAction).toHaveBeenCalledWith("version_1", { content: "", sort_order: 4 });
  });

  it("SOCIAL-08E hardening — disables Add Block while a create request is in flight, preventing a duplicate sort_order from a double-click", async () => {
    vi.mocked(listScriptBlocksAction).mockResolvedValue({ success: true, data: [] });
    let resolveCreate!: (value: Awaited<ReturnType<typeof createScriptBlockAction>>) => void;
    vi.mocked(createScriptBlockAction).mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ScriptBlockEditor scriptVersionId="version_1" canManage />);

    await screen.findByText("No blocks yet.");
    const addButton = screen.getByRole("button", { name: "Add Block" });
    await user.click(addButton);

    expect(addButton).toBeDisabled();
    expect(createScriptBlockAction).toHaveBeenCalledTimes(1);

    resolveCreate({ success: true, data: block({ id: "block_new", content: "" }) });
    await waitFor(() => expect(addButton).not.toBeDisabled());
  });

  it("saves edited content and position for a block", async () => {
    vi.mocked(listScriptBlocksAction).mockResolvedValue({ success: true, data: [block()] });
    vi.mocked(updateScriptBlockAction).mockResolvedValue({ success: true, data: block({ content: "Revised line.", sort_order: 2 }) });
    const user = userEvent.setup();
    render(<ScriptBlockEditor scriptVersionId="version_1" canManage />);

    const textarea = await screen.findByDisplayValue("Open on a wide shot of the venue.");
    await user.clear(textarea);
    await user.type(textarea, "Revised line.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateScriptBlockAction).toHaveBeenCalledWith("version_1", "block_1", { content: "Revised line.", sort_order: 0 });
  });

  it("removes a block, taking it out of the visible list", async () => {
    vi.mocked(listScriptBlocksAction).mockResolvedValue({
      success: true,
      data: [block({ id: "block_1", content: "Keep me" }), block({ id: "block_2", content: "Remove me", sort_order: 1 })],
    });
    vi.mocked(removeScriptBlockAction).mockResolvedValue({ success: true, data: null });
    const user = userEvent.setup();
    render(<ScriptBlockEditor scriptVersionId="version_1" canManage />);

    await screen.findByDisplayValue("Remove me");
    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    await user.click(removeButtons[1]);

    expect(removeScriptBlockAction).toHaveBeenCalledWith("version_1", "block_2");
    expect(screen.queryByDisplayValue("Remove me")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Keep me")).toBeInTheDocument();
  });

  it("shows a controlled error and keeps the block visible when removal fails", async () => {
    vi.mocked(listScriptBlocksAction).mockResolvedValue({ success: true, data: [block()] });
    vi.mocked(removeScriptBlockAction).mockResolvedValue({ success: false, error: "This Script block could not be found." });
    const user = userEvent.setup();
    render(<ScriptBlockEditor scriptVersionId="version_1" canManage />);

    await screen.findByDisplayValue("Open on a wide shot of the venue.");
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This Script block could not be found.");
    expect(screen.getByDisplayValue("Open on a wide shot of the venue.")).toBeInTheDocument();
  });

  it("hides Save/Remove/position editing for a read-only viewer", async () => {
    vi.mocked(listScriptBlocksAction).mockResolvedValue({ success: true, data: [block()] });
    render(<ScriptBlockEditor scriptVersionId="version_1" canManage={false} />);

    await screen.findByDisplayValue("Open on a wide shot of the venue.");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Position")).toBeDisabled();
    expect(screen.getByDisplayValue("Open on a wide shot of the venue.")).toBeDisabled();
  });

  it("never renders raw HTML from block content — plain text only", async () => {
    vi.mocked(listScriptBlocksAction).mockResolvedValue({ success: true, data: [block({ content: "<img src=x onerror=alert(1)>" })] });
    render(<ScriptBlockEditor scriptVersionId="version_1" canManage />);

    const textarea = await screen.findByDisplayValue("<img src=x onerror=alert(1)>");
    expect(within(document.body).queryByRole("img")).not.toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");
  });
});
