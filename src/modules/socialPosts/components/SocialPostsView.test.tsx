import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/socialPosts/socialPostActions", () => ({
  listSocialPostsAction: vi.fn(),
  createSocialPostAction: vi.fn(),
  publishSocialPostNowAction: vi.fn(),
  getSocialPostInsightsAction: vi.fn(),
}));

vi.mock("@/modules/integrations/meta/metaAccountActions", () => ({
  getSelectedMetaPublishingIdentityAction: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  listMediaAssetsForWorkspace: vi.fn(),
  getMediaAssetDownloadUrl: vi.fn(),
}));

import { listSocialPostsAction, createSocialPostAction, publishSocialPostNowAction, getSocialPostInsightsAction } from "@/modules/socialPosts/socialPostActions";
import { getSelectedMetaPublishingIdentityAction } from "@/modules/integrations/meta/metaAccountActions";
import { listMediaAssetsForWorkspace, getMediaAssetDownloadUrl } from "@/lib/data";
import { SocialPostsView } from "@/modules/socialPosts/components/SocialPostsView";
import type { SocialPost } from "@/types/socialPost";
import type { MediaAsset } from "@/types/mediaAsset";

const IDENTITY = { pageId: "page_1", pageName: "Amoré Bloom", instagramAccountId: "ig_1", instagramUsername: "amorebloom" };

function image(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "asset_1",
    workspace_id: "ws_1",
    owner_type: "workspace",
    owner_id: "ws_1",
    original_filename: "post.jpg",
    stored_filename: "post.jpg",
    storage_bucket: "media-assets",
    storage_path: "ws_1/post.jpg",
    mime_type: "image/jpeg",
    extension: "jpg",
    file_size: 1000,
    checksum: "abc",
    width: 1080,
    height: 1080,
    duration: null,
    version: 1,
    uploaded_by: "user_1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    folder_id: null,
    tags: [],
    color_label: null,
    priority: null,
    ai_ready: false,
    status: "approved",
    approved_by: "member_1",
    approved_at: "2026-01-01T00:00:00Z",
    rejection_reason: null,
    version_notes: null,
    metadata: { pages: null, author: null, license: null, brand: null, colorProfile: null, cameraData: null, location: null, custom: {} },
    ...overrides,
  };
}

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
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("SocialPostsView", () => {
  it("prompts to connect Meta when no publishing identity is selected", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(listMediaAssetsForWorkspace).mockResolvedValue([]);

    render(<SocialPostsView />);

    expect(await screen.findByText(/no instagram publishing identity is selected/i)).toBeInTheDocument();
    expect(screen.queryByText("New Post")).not.toBeInTheDocument();
  });

  it("shows the create panel with the real destination once an identity is selected", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listMediaAssetsForWorkspace).mockResolvedValue([image()]);
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/post.jpg", expiresAt: "2026-01-01T00:05:00Z" } });

    render(<SocialPostsView />);

    expect(await screen.findByText("New Post")).toBeInTheDocument();
    expect(screen.getByText("Publishing to Instagram: @amorebloom")).toBeInTheDocument();
  });

  it("only shows approved JPEG images in the picker — never a non-JPEG or unapproved asset", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listMediaAssetsForWorkspace).mockResolvedValue([
      image({ id: "jpeg_approved", mime_type: "image/jpeg", status: "approved" }),
      image({ id: "png_approved", mime_type: "image/png", status: "approved" }),
      image({ id: "jpeg_pending", mime_type: "image/jpeg", status: "pending" }),
    ]);
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/x.jpg", expiresAt: "2026-01-01T00:05:00Z" } });

    render(<SocialPostsView />);
    await screen.findByText("New Post");

    expect(await screen.findAllByRole("button", { name: "post.jpg" })).toHaveLength(1);
  });

  it("saves a draft without publishing", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listMediaAssetsForWorkspace).mockResolvedValue([image()]);
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/post.jpg", expiresAt: "2026-01-01T00:05:00Z" } });
    vi.mocked(createSocialPostAction).mockResolvedValue({ success: true, data: post() });

    render(<SocialPostsView />);
    await user.click(await screen.findByRole("button", { name: "post.jpg" }));
    await user.click(screen.getByRole("button", { name: "Save Draft" }));

    await waitFor(() => expect(createSocialPostAction).toHaveBeenCalledWith({ caption: "", assetId: "asset_1" }));
    expect(publishSocialPostNowAction).not.toHaveBeenCalled();
  });

  it("creates and publishes immediately via Publish Now", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listMediaAssetsForWorkspace).mockResolvedValue([image()]);
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/post.jpg", expiresAt: "2026-01-01T00:05:00Z" } });
    vi.mocked(createSocialPostAction).mockResolvedValue({ success: true, data: post() });
    vi.mocked(publishSocialPostNowAction).mockResolvedValue({ success: true, data: post({ status: "published" }) });

    render(<SocialPostsView />);
    await user.click(await screen.findByRole("button", { name: "post.jpg" }));
    await user.click(screen.getAllByRole("button", { name: /publish now/i })[0]);

    await waitFor(() => expect(createSocialPostAction).toHaveBeenCalled());
    await waitFor(() => expect(publishSocialPostNowAction).toHaveBeenCalledWith("post_1"));
  });

  it("shows the real published state with a permalink link, never a fabricated URL", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({
      success: true,
      data: [post({ status: "published", provider_permalink: "https://www.instagram.com/p/abc123/" })],
    });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listMediaAssetsForWorkspace).mockResolvedValue([]);

    render(<SocialPostsView />);

    expect(await screen.findByText("Published")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "View on Instagram" });
    expect(link).toHaveAttribute("href", "https://www.instagram.com/p/abc123/");
  });

  it("never shows a permalink link when one isn't available", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "published", provider_permalink: null })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listMediaAssetsForWorkspace).mockResolvedValue([]);

    render(<SocialPostsView />);

    await screen.findByText("Published");
    expect(screen.queryByRole("link", { name: "View on Instagram" })).not.toBeInTheDocument();
  });

  it("shows a Retry button and the sanitized error for a failed post", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "failed", provider_error: "Reconnect Meta to enable publishing." })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listMediaAssetsForWorkspace).mockResolvedValue([]);

    render(<SocialPostsView />);

    expect(await screen.findByText("Reconnect Meta to enable publishing.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("never shows a Publish Now/Retry button for an already-published post", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "published" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listMediaAssetsForWorkspace).mockResolvedValue([]);

    render(<SocialPostsView />);

    await screen.findByText("Published");
    // Scope to the Posts list itself — the New Post form above always renders its own
    // (disabled, no-asset-selected) "Publish Now" button, which is not what this asserts against.
    const postsList = screen.getByRole("list");
    expect(within(postsList).queryByRole("button", { name: /publish now/i })).not.toBeInTheDocument();
    expect(within(postsList).queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("shows a 'Refresh insights' control only for a published post, never for draft/failed", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ id: "p1", status: "published" }), post({ id: "p2", status: "draft" }), post({ id: "p3", status: "failed" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listMediaAssetsForWorkspace).mockResolvedValue([]);

    render(<SocialPostsView />);
    await screen.findByText("Published");

    expect(screen.getAllByRole("button", { name: "Refresh insights" })).toHaveLength(1);
  });

  it("fetches and renders real metrics on Refresh insights — never a fabricated value", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "published" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listMediaAssetsForWorkspace).mockResolvedValue([]);
    vi.mocked(getSocialPostInsightsAction).mockResolvedValue({ success: true, data: { metrics: { reach: 120, likes: 0 } } });

    render(<SocialPostsView />);
    await user.click(await screen.findByRole("button", { name: "Refresh insights" }));

    expect(await screen.findByText("120")).toBeInTheDocument();
    expect(screen.getByText("Reach")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Likes")).toBeInTheDocument();
    // Never render a metric that wasn't in the result — no fabricated "0 Views".
    expect(screen.queryByText("Views")).not.toBeInTheDocument();
  });

  it("shows a truthful 'not available yet' message when the provider returns no metrics at all — never a fabricated zero", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "published" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listMediaAssetsForWorkspace).mockResolvedValue([]);
    vi.mocked(getSocialPostInsightsAction).mockResolvedValue({ success: true, data: { metrics: {} } });

    render(<SocialPostsView />);
    await user.click(await screen.findByRole("button", { name: "Refresh insights" }));

    expect(await screen.findByText("Insights may not be available yet.")).toBeInTheDocument();
  });

  it("shows the exact truthful error (e.g. reconnect-required) when insights fail — never renders stale/fabricated metrics", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "published" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listMediaAssetsForWorkspace).mockResolvedValue([]);
    vi.mocked(getSocialPostInsightsAction).mockResolvedValue({ success: false, error: "Reconnect Meta to enable Instagram analytics." });

    render(<SocialPostsView />);
    await user.click(await screen.findByRole("button", { name: "Refresh insights" }));

    expect(await screen.findByText("Reconnect Meta to enable Instagram analytics.")).toBeInTheDocument();
  });
});
