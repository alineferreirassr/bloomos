import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/data", () => ({ getMediaAssetDownloadUrl: vi.fn() }));

import { getMediaAssetDownloadUrl } from "@/lib/data";
import { SocialFeedPreview, orderFeedPosts } from "@/modules/socialPosts/components/SocialFeedPreview";
import type { SocialPost } from "@/types/socialPost";

function post(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "post_1",
    workspace_id: "ws_1",
    created_by: "user_1",
    status: "draft",
    caption: "Hello!",
    asset_id: "asset_1",
    target_provider: "meta",
    target_connection_id: "conn_1",
    target_page_id: "page_1",
    target_instagram_account_id: "ig_1",
    provider_container_id: null,
    provider_post_id: null,
    provider_permalink: null,
    provider_error: null,
    published_at: null,
    scheduled_at: null,
    scheduled_timezone: null,
    publish_attempts: 0,
    next_attempt_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function noopHandlers() {
  return {
    onCreatePost: vi.fn(),
    onSchedule: vi.fn(),
    onReschedule: vi.fn(),
    onCancelSchedule: vi.fn(),
    onPublishNow: vi.fn(),
    publishingId: null,
    cancelingId: null,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("orderFeedPosts — SOCIAL-04D deterministic ordering", () => {
  it("orders publishing, then scheduled (soonest first), then draft/failed (most recently touched), then published (newest first)", () => {
    const publishing = post({ id: "publishing", status: "publishing", updated_at: "2026-01-01T00:00:00Z" });
    const scheduledLater = post({ id: "scheduled_later", status: "scheduled", scheduled_at: "2026-03-01T00:00:00Z" });
    const scheduledSoon = post({ id: "scheduled_soon", status: "scheduled", scheduled_at: "2026-02-01T00:00:00Z" });
    const draftOld = post({ id: "draft_old", status: "draft", updated_at: "2026-01-05T00:00:00Z" });
    const draftNew = post({ id: "draft_new", status: "draft", updated_at: "2026-01-10T00:00:00Z" });
    const publishedOld = post({ id: "published_old", status: "published", published_at: "2025-12-01T00:00:00Z" });
    const publishedNew = post({ id: "published_new", status: "published", published_at: "2025-12-15T00:00:00Z" });

    const ordered = orderFeedPosts([publishedOld, draftOld, scheduledLater, publishedNew, scheduledSoon, publishing, draftNew]);

    expect(ordered.map((p) => p.id)).toEqual(["publishing", "scheduled_soon", "scheduled_later", "draft_new", "draft_old", "published_new", "published_old"]);
  });

  it("groups draft and failed together, both ordered by most-recently-touched first", () => {
    const draftOld = post({ id: "draft_old", status: "draft", updated_at: "2026-01-01T00:00:00Z" });
    const failedNew = post({ id: "failed_new", status: "failed", updated_at: "2026-01-05T00:00:00Z" });

    const ordered = orderFeedPosts([draftOld, failedNew]);
    expect(ordered.map((p) => p.id)).toEqual(["failed_new", "draft_old"]);
  });

  it("is stable and deterministic across repeated calls on the same input", () => {
    const posts = [post({ id: "a", status: "draft", updated_at: "2026-01-01T00:00:00Z" }), post({ id: "b", status: "draft", updated_at: "2026-01-02T00:00:00Z" })];
    const first = orderFeedPosts(posts).map((p) => p.id);
    const second = orderFeedPosts(posts).map((p) => p.id);
    expect(first).toEqual(second);
  });
});

describe("SocialFeedPreview", () => {
  it("shows a polished empty state with a path back to the composer when there are no posts", async () => {
    const user = userEvent.setup();
    const handlers = noopHandlers();
    render(<SocialFeedPreview posts={[]} {...handlers} />);

    expect(screen.getByText(/feed preview starts here/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create a post" }));
    expect(handlers.onCreatePost).toHaveBeenCalledTimes(1);
  });

  it("renders a fixed 3-column grid", () => {
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not found" });
    const { container } = render(<SocialFeedPreview posts={[post()]} {...noopHandlers()} />);
    const grid = container.querySelector(".grid");
    expect(grid).toHaveClass("grid-cols-3");
  });

  it("renders one tile per post across every status — draft, scheduled, publishing, published, failed all appear", () => {
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not found" });
    const posts = [
      post({ id: "p_draft", status: "draft" }),
      post({ id: "p_scheduled", status: "scheduled", scheduled_at: "2099-01-01T00:00:00Z" }),
      post({ id: "p_publishing", status: "publishing" }),
      post({ id: "p_published", status: "published", published_at: "2026-01-01T00:00:00Z" }),
      post({ id: "p_failed", status: "failed" }),
    ];
    render(<SocialFeedPreview posts={posts} {...noopHandlers()} />);

    expect(screen.getAllByRole("button", { name: /draft|scheduled|publishing|published|failed/i })).toHaveLength(5);
  });

  it("exposes status textually on the tile (never color-only) — draft/scheduled/publishing/failed all show a text label", () => {
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not found" });
    const posts = [
      post({ id: "p_draft", status: "draft" }),
      post({ id: "p_scheduled", status: "scheduled", scheduled_at: "2099-01-01T00:00:00Z" }),
      post({ id: "p_publishing", status: "publishing" }),
      post({ id: "p_failed", status: "failed" }),
    ];
    render(<SocialFeedPreview posts={posts} {...noopHandlers()} />);

    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Publishing…")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("uses the correct signed asset preview for each tile", async () => {
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/real.jpg", expiresAt: "2026-01-01T00:05:00Z" } });
    render(<SocialFeedPreview posts={[post({ asset_id: "asset_real" })]} {...noopHandlers()} />);

    await waitFor(() => expect(getMediaAssetDownloadUrl).toHaveBeenCalledWith("asset_real"));
    const img = await screen.findByAltText("Hello!");
    expect(img).toHaveAttribute("src", "https://signed.example.com/real.jpg");
  });

  it("renders a graceful placeholder — never a broken image icon or raw URL — when the asset is missing/unavailable", async () => {
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "Media asset not found." });
    render(<SocialFeedPreview posts={[post()]} {...noopHandlers()} />);

    expect(await screen.findByText("Image unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("one asset failing to load does not crash the rest of the grid — other tiles still render", async () => {
    vi.mocked(getMediaAssetDownloadUrl).mockImplementation(async (id: string) =>
      id === "asset_broken" ? { success: false, error: "not found" } : { success: true, data: { url: "https://signed.example.com/ok.jpg", expiresAt: "2026-01-01T00:05:00Z" } },
    );
    const posts = [post({ id: "p1", asset_id: "asset_broken", caption: "Broken" }), post({ id: "p2", asset_id: "asset_ok", caption: "Ok" })];
    render(<SocialFeedPreview posts={posts} {...noopHandlers()} />);

    expect(await screen.findByText("Image unavailable")).toBeInTheDocument();
    expect(await screen.findByAltText("Ok")).toBeInTheDocument();
  });

  it("clicking a tile opens the detail modal showing the caption", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not found" });
    render(<SocialFeedPreview posts={[post({ caption: "A very specific caption" })]} {...noopHandlers()} />);

    await user.click(screen.getByRole("button", { name: /draft/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("A very specific caption")).toBeInTheDocument();
  });

  it("scheduled post detail shows a human-readable date/time, never a raw ISO string", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not found" });
    render(<SocialFeedPreview posts={[post({ status: "scheduled", scheduled_at: "2099-06-01T15:00:00.000Z", scheduled_timezone: "UTC" })]} {...noopHandlers()} />);

    await user.click(screen.getByRole("button", { name: /scheduled/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Scheduled for/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/2099-06-01T15:00:00/)).not.toBeInTheDocument();
  });

  it("published post detail exposes the permalink only when one is present", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not found" });
    const withLink = post({ id: "with_link", status: "published", published_at: "2026-01-01T00:00:00Z", provider_permalink: "https://www.instagram.com/p/abc123/" });
    const { rerender } = render(<SocialFeedPreview posts={[withLink]} {...noopHandlers()} />);

    await user.click(screen.getByRole("button", { name: /published/i }));
    expect(within(screen.getByRole("dialog")).getByRole("link", { name: /view on instagram/i })).toHaveAttribute("href", "https://www.instagram.com/p/abc123/");

    const withoutLink = post({ id: "without_link", status: "published", published_at: "2026-01-01T00:00:00Z", provider_permalink: null });
    rerender(<SocialFeedPreview posts={[withoutLink]} {...noopHandlers()} />);
    await user.click(screen.getByRole("button", { name: /published/i }));
    expect(within(screen.getByRole("dialog")).queryByRole("link", { name: /view on instagram/i })).not.toBeInTheDocument();
  });

  it("shows Schedule and Publish Now for a draft post, and Retry for a failed one — never both labels for the same post", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not found" });
    render(<SocialFeedPreview posts={[post({ status: "draft" })]} {...noopHandlers()} />);
    await user.click(screen.getByRole("button", { name: /draft/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Schedule" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Publish Now" })).toBeInTheDocument();
  });

  it("shows Reschedule, Publish Now, and Cancel schedule for a scheduled post, wired to the passed-in handlers", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not found" });
    const handlers = noopHandlers();
    const scheduledPost = post({ status: "scheduled", scheduled_at: "2099-01-01T00:00:00Z" });
    render(<SocialFeedPreview posts={[scheduledPost]} {...handlers} />);
    await user.click(screen.getByRole("button", { name: /scheduled/i }));

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Reschedule" }));
    expect(handlers.onReschedule).toHaveBeenCalledWith(scheduledPost);

    await user.click(within(dialog).getByRole("button", { name: "Publish Now" }));
    expect(handlers.onPublishNow).toHaveBeenCalledWith(scheduledPost);

    await user.click(within(dialog).getByRole("button", { name: "Cancel schedule" }));
    expect(handlers.onCancelSchedule).toHaveBeenCalledWith(scheduledPost);
  });

  it("a publishing post's detail hides every conflicting state-transition action", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not found" });
    render(<SocialFeedPreview posts={[post({ status: "publishing" })]} {...noopHandlers()} />);
    await user.click(screen.getByRole("button", { name: /publishing/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Schedule" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /publish now/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Reschedule" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Cancel schedule" })).not.toBeInTheDocument();
  });

  it("a published post's detail hides every scheduling control", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not found" });
    render(<SocialFeedPreview posts={[post({ status: "published", published_at: "2026-01-01T00:00:00Z" })]} {...noopHandlers()} />);
    await user.click(screen.getByRole("button", { name: /published/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Schedule" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Reschedule" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Cancel schedule" })).not.toBeInTheDocument();
  });

  it("a failed post's detail shows the sanitized error, Retry, Schedule, and a humanized retry-scheduled hint when next_attempt_at is set — never a raw timestamp", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not found" });
    render(
      <SocialFeedPreview
        posts={[post({ status: "failed", provider_error: "Reconnect Meta to enable publishing.", next_attempt_at: "2099-01-01T00:05:00.000Z", scheduled_timezone: "UTC" })]}
        {...noopHandlers()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /failed/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Reconnect Meta to enable publishing.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Schedule" })).toBeInTheDocument();
    expect(within(dialog).getByText(/Retry scheduled for/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/2099-01-01T00:05:00/)).not.toBeInTheDocument();
  });

  it("every tile is a real, keyboard-reachable button with a meaningful accessible name", () => {
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not found" });
    render(<SocialFeedPreview posts={[post({ status: "draft", caption: "Keyboard reachable" })]} {...noopHandlers()} />);

    const tile = screen.getByRole("button", { name: /draft: keyboard reachable/i });
    expect(tile.tagName).toBe("BUTTON");
  });

  it("never renders a raw ISO timestamp anywhere in the grid or detail view", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not found" });
    render(<SocialFeedPreview posts={[post({ status: "scheduled", scheduled_at: "2099-06-01T15:00:00.000Z" })]} {...noopHandlers()} />);
    await user.click(screen.getByRole("button", { name: /scheduled/i }));

    expect(screen.queryByText(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)).not.toBeInTheDocument();
  });
});
