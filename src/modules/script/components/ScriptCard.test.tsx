import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScriptCard } from "@/modules/script/components/ScriptCard";
import type { ScriptItem } from "@/types/scriptItem";

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

afterEach(() => {
  vi.clearAllMocks();
});

describe("ScriptCard", () => {
  it("renders the title", () => {
    render(<ScriptCard item={item()} onOpen={vi.fn()} />);
    expect(screen.getByText("Spring wedding behind-the-scenes")).toBeInTheDocument();
  });

  it("shows an Archived badge for an archived item", () => {
    render(<ScriptCard item={item({ archived_at: "2026-09-23T00:00:00Z", status: "archived" })} onOpen={vi.fn()} />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("does not show an Archived badge for an active item", () => {
    render(<ScriptCard item={item({ archived_at: null })} onOpen={vi.fn()} />);
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });

  it("calls onOpen with the item when clicked", async () => {
    const onOpen = vi.fn();
    render(<ScriptCard item={item()} onOpen={onOpen} />);
    screen.getByRole("button").click();
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "script_1" }));
  });

  it("never renders raw HTML from the title — plain text only", () => {
    render(<ScriptCard item={item({ title: "<img src=x onerror=alert(1)>" })} onOpen={vi.fn()} />);
    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  });
});
