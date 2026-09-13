import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IdeaCard } from "@/modules/idea/components/IdeaCard";
import type { IdeaItem } from "@/types/ideaItem";

function item(overrides: Partial<IdeaItem> = {}): IdeaItem {
  return {
    id: "idea_1",
    workspace_id: "ws_1",
    title: "Behind the scenes at a spring wedding",
    description: "A short reel following setup to first dance.",
    status: "active",
    source_inspiration_id: null,
    content_format: "reel",
    hook: null,
    cta: null,
    audience: null,
    notes: null,
    media_asset_id: null,
    priority: "high",
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-09-20T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("IdeaCard", () => {
  it("renders title, description, priority, and content format", () => {
    render(<IdeaCard item={item()} onOpen={vi.fn()} />);
    expect(screen.getByText("Behind the scenes at a spring wedding")).toBeInTheDocument();
    expect(screen.getByText("A short reel following setup to first dance.")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Reel")).toBeInTheDocument();
  });

  it("renders without a broken UI when every optional field is null", () => {
    render(<IdeaCard item={item({ content_format: null, priority: null })} onOpen={vi.fn()} />);
    expect(screen.getByText("Behind the scenes at a spring wedding")).toBeInTheDocument();
  });

  it("shows an Archived badge for an archived item", () => {
    render(<IdeaCard item={item({ archived_at: "2026-09-21T00:00:00Z", status: "archived" })} onOpen={vi.fn()} />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("does not show an Archived badge for an active item", () => {
    render(<IdeaCard item={item({ archived_at: null })} onOpen={vi.fn()} />);
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });

  it("calls onOpen with the item when clicked", async () => {
    const onOpen = vi.fn();
    render(<IdeaCard item={item()} onOpen={onOpen} />);
    screen.getByRole("button").click();
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "idea_1" }));
  });

  it("never renders raw HTML from the description — plain text only", () => {
    render(<IdeaCard item={item({ description: "<img src=x onerror=alert(1)>" })} onOpen={vi.fn()} />);
    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  });
});
