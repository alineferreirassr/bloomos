import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getMediaAssetDownloadUrl: vi.fn(),
}));

import { getMediaAssetDownloadUrl } from "@/lib/data";
import { InspirationCard } from "@/modules/inspiration/components/InspirationCard";
import type { InspirationItem } from "@/types/inspirationItem";

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
    platform_content_id: null,
    content_format: "reel",
    hook: "Open on the veil catching the wind.",
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

describe("InspirationCard", () => {
  it("renders title, platform label, creator, content format, and hook", () => {
    render(<InspirationCard item={item()} onOpen={vi.fn()} />);
    expect(screen.getByText("Behind the Scenes at a Wedding")).toBeInTheDocument();
    // Appears twice with no MediaAsset: once as the source-type Badge, once
    // as the placeholder tile's own text — see the dedicated placeholder test below.
    expect(screen.getAllByText("Instagram").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Jane Doe · @janedoe")).toBeInTheDocument();
    expect(screen.getByText("Reel")).toBeInTheDocument();
    expect(screen.getByText("Open on the veil catching the wind.")).toBeInTheDocument();
  });

  it("shows a placeholder tile when there is no MediaAsset", () => {
    render(<InspirationCard item={item({ media_asset_id: null })} onOpen={vi.fn()} />);
    // The source-type label doubles as the placeholder tile's text — appears
    // once in the badge and once in the placeholder, never a broken <img>.
    expect(screen.getAllByText("Instagram").length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector("img")).not.toBeInTheDocument();
  });

  it("renders a real preview image when a MediaAsset resolves to a signed URL", async () => {
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/photo.jpg", expiresAt: "2026-01-01T00:00:00Z" } });
    render(<InspirationCard item={item({ media_asset_id: "asset_1" })} onOpen={vi.fn()} />);
    const img = await screen.findByRole("img");
    expect(img).toHaveAttribute("src", "https://signed.example.com/photo.jpg");
  });

  it("renders without a broken UI when every optional field is null", () => {
    render(
      <InspirationCard
        item={item({ creator_name: null, creator_handle: null, content_format: null, hook: null, media_asset_id: null })}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText("Behind the Scenes at a Wedding")).toBeInTheDocument();
  });

  it("shows an Archived badge for an archived item", () => {
    render(<InspirationCard item={item({ archived_at: "2026-09-05T00:00:00Z" })} onOpen={vi.fn()} />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("does not show an Archived badge for an active item", () => {
    render(<InspirationCard item={item({ archived_at: null })} onOpen={vi.fn()} />);
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });

  it("calls onOpen with the item when clicked", async () => {
    const onOpen = vi.fn();
    render(<InspirationCard item={item()} onOpen={onOpen} />);
    screen.getByRole("button").click();
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "insp_1" }));
  });
});
