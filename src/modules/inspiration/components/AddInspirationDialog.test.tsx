import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/inspiration/inspirationActions", () => ({
  createInspirationItemAction: vi.fn(),
}));

import { createInspirationItemAction } from "@/modules/inspiration/inspirationActions";
import { AddInspirationDialog } from "@/modules/inspiration/components/AddInspirationDialog";
import type { InspirationItem } from "@/types/inspirationItem";

function createdItem(overrides: Partial<InspirationItem> = {}): InspirationItem {
  return {
    id: "insp_new",
    workspace_id: "ws_1",
    title: "New idea",
    source_type: "manual",
    source_url: null,
    normalized_source_url: null,
    creator_name: null,
    creator_handle: null,
    platform_content_id: null,
    content_format: null,
    hook: null,
    cta: null,
    why_it_works: null,
    notes: null,
    duration_seconds: null,
    published_at: null,
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

describe("AddInspirationDialog", () => {
  it("renders nothing when closed", () => {
    render(<AddInspirationDialog open={false} onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires a non-empty title before submitting", async () => {
    const user = userEvent.setup();
    render(<AddInspirationDialog open onClose={vi.fn()} onCreated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add Inspiration" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Title is required.");
    expect(createInspirationItemAction).not.toHaveBeenCalled();
  });

  it("creates a manual reference with no URL", async () => {
    vi.mocked(createInspirationItemAction).mockResolvedValue({ success: true, data: createdItem() });
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(<AddInspirationDialog open onClose={onClose} onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Title"), "New idea");
    await user.click(screen.getByRole("button", { name: "Add Inspiration" }));

    expect(createInspirationItemAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New idea", source_type: "manual", source_url: null }),
    );
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("never sends workspace_id, normalized_source_url, or created_by from the browser", async () => {
    vi.mocked(createInspirationItemAction).mockResolvedValue({ success: true, data: createdItem() });
    const user = userEvent.setup();
    render(<AddInspirationDialog open onClose={vi.fn()} onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "New idea");
    await user.click(screen.getByRole("button", { name: "Add Inspiration" }));

    const sentInput = vi.mocked(createInspirationItemAction).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(sentInput).not.toHaveProperty("workspace_id");
    expect(sentInput).not.toHaveProperty("normalized_source_url");
    expect(sentInput).not.toHaveProperty("created_by");
  });

  it("suggests a source type from a recognized URL when the founder hasn't manually chosen one", async () => {
    vi.mocked(createInspirationItemAction).mockResolvedValue({ success: true, data: createdItem() });
    const user = userEvent.setup();
    render(<AddInspirationDialog open onClose={vi.fn()} onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "IG idea");
    await user.type(screen.getByLabelText("Source URL (optional)"), "https://instagram.com/reel/abc");
    expect(screen.getByLabelText("Source Type")).toHaveValue("instagram");
  });

  it("does not override a manual source type selection with a later URL suggestion", async () => {
    vi.mocked(createInspirationItemAction).mockResolvedValue({ success: true, data: createdItem() });
    const user = userEvent.setup();
    render(<AddInspirationDialog open onClose={vi.fn()} onCreated={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText("Source Type"), "tiktok");
    await user.type(screen.getByLabelText("Source URL (optional)"), "https://instagram.com/reel/abc");
    expect(screen.getByLabelText("Source Type")).toHaveValue("tiktok");
  });

  it("shows a controlled invalid-URL error from the server without crashing or closing", async () => {
    vi.mocked(createInspirationItemAction).mockResolvedValue({ success: false, error: "Only http and https links are supported." });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AddInspirationDialog open onClose={onClose} onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "Bad URL idea");
    await user.click(screen.getByRole("button", { name: "Add Inspiration" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Only http and https links are supported.");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps the dialog open with a friendly message on a duplicate error, never a raw Postgres error", async () => {
    vi.mocked(createInspirationItemAction).mockResolvedValue({ success: false, error: "This has already been saved to your Inspiration library." });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AddInspirationDialog open onClose={onClose} onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "Duplicate idea");
    await user.click(screen.getByRole("button", { name: "Add Inspiration" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This has already been saved to your Inspiration library.");
    expect(alert.textContent).not.toMatch(/23505|constraint|postgres/i);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Title")).toHaveValue("Duplicate idea");
  });
});
