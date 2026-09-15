import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/carousel/carouselActions", () => ({
  createCarouselItemAction: vi.fn(),
}));

import { createCarouselItemAction } from "@/modules/carousel/carouselActions";
import { AddCarouselDialog } from "@/modules/carousel/components/AddCarouselDialog";
import type { CarouselItem } from "@/types/carouselItem";

function createdItem(overrides: Partial<CarouselItem> = {}): CarouselItem {
  return {
    id: "carousel_new",
    workspace_id: "ws_1",
    title: "New carousel",
    status: "active",
    source_idea_id: null,
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-09-24T00:00:00Z",
    updated_at: "2026-09-24T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("AddCarouselDialog", () => {
  it("renders nothing when closed", () => {
    render(<AddCarouselDialog open={false} onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires a non-empty title before submitting", async () => {
    const user = userEvent.setup();
    render(<AddCarouselDialog open onClose={vi.fn()} onCreated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Create Carousel" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Title is required.");
    expect(createCarouselItemAction).not.toHaveBeenCalled();
  });

  it("creates a Carousel with only a title", async () => {
    vi.mocked(createCarouselItemAction).mockResolvedValue({ success: true, data: createdItem() });
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(<AddCarouselDialog open onClose={onClose} onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Title"), "New carousel");
    await user.click(screen.getByRole("button", { name: "Create Carousel" }));

    expect(createCarouselItemAction).toHaveBeenCalledWith(expect.objectContaining({ title: "New carousel", source_idea_id: null }));
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("never sends workspace_id, status, or created_by from the browser", async () => {
    vi.mocked(createCarouselItemAction).mockResolvedValue({ success: true, data: createdItem() });
    const user = userEvent.setup();
    render(<AddCarouselDialog open onClose={vi.fn()} onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "New carousel");
    await user.click(screen.getByRole("button", { name: "Create Carousel" }));

    const sentInput = vi.mocked(createCarouselItemAction).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(sentInput).not.toHaveProperty("workspace_id");
    expect(sentInput).not.toHaveProperty("status");
    expect(sentInput).not.toHaveProperty("created_by");
  });

  it("does not offer a source Idea picker in this dialog — linking lives in the detail view", () => {
    render(<AddCarouselDialog open onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.queryByLabelText(/idea/i)).not.toBeInTheDocument();
  });

  it("shows a controlled error from the server without crashing or closing", async () => {
    vi.mocked(createCarouselItemAction).mockResolvedValue({ success: false, error: "That isn't available. You may not have access to it." });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AddCarouselDialog open onClose={onClose} onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "New carousel");
    await user.click(screen.getByRole("button", { name: "Create Carousel" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That isn't available. You may not have access to it.");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("resets its fields on the next open after a previous session", async () => {
    vi.mocked(createCarouselItemAction).mockResolvedValue({ success: true, data: createdItem() });
    const user = userEvent.setup();
    const { rerender } = render(<AddCarouselDialog open onClose={vi.fn()} onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "Stale text");
    rerender(<AddCarouselDialog open={false} onClose={vi.fn()} onCreated={vi.fn()} />);
    rerender(<AddCarouselDialog open onClose={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.getByLabelText("Title")).toHaveValue("");
  });

  it("disables the submit button while a create request is in flight, preventing a duplicate submission", async () => {
    let resolveCreate!: (value: Awaited<ReturnType<typeof createCarouselItemAction>>) => void;
    vi.mocked(createCarouselItemAction).mockReturnValue(new Promise((resolve) => (resolveCreate = resolve)));
    const user = userEvent.setup();
    render(<AddCarouselDialog open onClose={vi.fn()} onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "New carousel");
    const submitButton = screen.getByRole("button", { name: "Create Carousel" });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(createCarouselItemAction).toHaveBeenCalledTimes(1);

    resolveCreate({ success: true, data: createdItem() });
  });
});
