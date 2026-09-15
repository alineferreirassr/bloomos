import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CarouselCard } from "@/modules/carousel/components/CarouselCard";
import type { CarouselItem } from "@/types/carouselItem";

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

afterEach(() => {
  vi.clearAllMocks();
});

describe("CarouselCard", () => {
  it("renders the title", () => {
    render(<CarouselCard item={item()} onOpen={vi.fn()} />);
    expect(screen.getByText("Autumn wedding carousel")).toBeInTheDocument();
  });

  it("shows an Archived badge for an archived item", () => {
    render(<CarouselCard item={item({ archived_at: "2026-09-24T00:00:00Z", status: "archived" })} onOpen={vi.fn()} />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("does not show an Archived badge for an active item", () => {
    render(<CarouselCard item={item({ archived_at: null })} onOpen={vi.fn()} />);
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });

  it("calls onOpen with the item when clicked", () => {
    const onOpen = vi.fn();
    render(<CarouselCard item={item()} onOpen={onOpen} />);
    screen.getByRole("button").click();
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "carousel_1" }));
  });

  it("never renders raw HTML from the title — plain text only", () => {
    render(<CarouselCard item={item({ title: "<img src=x onerror=alert(1)>" })} onOpen={vi.fn()} />);
    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  });
});
