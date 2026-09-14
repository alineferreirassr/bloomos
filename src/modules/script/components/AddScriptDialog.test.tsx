import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/script/scriptActions", () => ({
  createScriptItemAction: vi.fn(),
}));

import { createScriptItemAction } from "@/modules/script/scriptActions";
import { AddScriptDialog } from "@/modules/script/components/AddScriptDialog";
import type { ScriptItem } from "@/types/scriptItem";

function createdItem(overrides: Partial<ScriptItem> = {}): ScriptItem {
  return {
    id: "script_new",
    workspace_id: "ws_1",
    title: "New script",
    status: "active",
    source_idea_id: null,
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-09-22T00:00:00Z",
    updated_at: "2026-09-22T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("AddScriptDialog", () => {
  it("renders nothing when closed", () => {
    render(<AddScriptDialog open={false} onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires a non-empty title before submitting", async () => {
    const user = userEvent.setup();
    render(<AddScriptDialog open onClose={vi.fn()} onCreated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Create Script" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Title is required.");
    expect(createScriptItemAction).not.toHaveBeenCalled();
  });

  it("creates a Script with only a title", async () => {
    vi.mocked(createScriptItemAction).mockResolvedValue({ success: true, data: createdItem() });
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(<AddScriptDialog open onClose={onClose} onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Title"), "New script");
    await user.click(screen.getByRole("button", { name: "Create Script" }));

    expect(createScriptItemAction).toHaveBeenCalledWith(expect.objectContaining({ title: "New script", source_idea_id: null }));
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("never sends workspace_id, status, or created_by from the browser", async () => {
    vi.mocked(createScriptItemAction).mockResolvedValue({ success: true, data: createdItem() });
    const user = userEvent.setup();
    render(<AddScriptDialog open onClose={vi.fn()} onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "New script");
    await user.click(screen.getByRole("button", { name: "Create Script" }));

    const sentInput = vi.mocked(createScriptItemAction).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(sentInput).not.toHaveProperty("workspace_id");
    expect(sentInput).not.toHaveProperty("status");
    expect(sentInput).not.toHaveProperty("created_by");
  });

  it("does not offer a source Idea picker in this dialog — linking lives in the detail view", () => {
    render(<AddScriptDialog open onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.queryByLabelText(/idea/i)).not.toBeInTheDocument();
  });

  it("shows a controlled error from the server without crashing or closing", async () => {
    vi.mocked(createScriptItemAction).mockResolvedValue({ success: false, error: "That isn't available. You may not have access to it." });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AddScriptDialog open onClose={onClose} onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "New script");
    await user.click(screen.getByRole("button", { name: "Create Script" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That isn't available. You may not have access to it.");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("resets its fields on the next open after a previous session", async () => {
    vi.mocked(createScriptItemAction).mockResolvedValue({ success: true, data: createdItem() });
    const user = userEvent.setup();
    const { rerender } = render(<AddScriptDialog open onClose={vi.fn()} onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "Stale text");
    rerender(<AddScriptDialog open={false} onClose={vi.fn()} onCreated={vi.fn()} />);
    rerender(<AddScriptDialog open onClose={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.getByLabelText("Title")).toHaveValue("");
  });
});
