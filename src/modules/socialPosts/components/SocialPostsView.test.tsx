import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/socialPosts/socialPostActions", () => ({
  listSocialPostsAction: vi.fn(),
  createSocialPostAction: vi.fn(),
  publishSocialPostNowAction: vi.fn(),
  scheduleSocialPostAction: vi.fn(),
  rescheduleSocialPostAction: vi.fn(),
  cancelSocialPostScheduleAction: vi.fn(),
  listSocialMediaAssetsAction: vi.fn(),
  getSocialPostInsightsAction: vi.fn(),
}));

vi.mock("@/modules/integrations/meta/metaAccountActions", () => ({
  getSelectedMetaPublishingIdentityAction: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  getMediaAssetDownloadUrl: vi.fn(),
}));

import {
  listSocialPostsAction,
  createSocialPostAction,
  publishSocialPostNowAction,
  scheduleSocialPostAction,
  rescheduleSocialPostAction,
  cancelSocialPostScheduleAction,
  listSocialMediaAssetsAction,
  getSocialPostInsightsAction,
} from "@/modules/socialPosts/socialPostActions";
import { getSelectedMetaPublishingIdentityAction } from "@/modules/integrations/meta/metaAccountActions";
import { getMediaAssetDownloadUrl } from "@/lib/data";
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
    scheduled_at: null,
    scheduled_timezone: null,
    publish_attempts: 0,
    next_attempt_at: null,
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
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

    render(<SocialPostsView />);

    expect(await screen.findByText(/no instagram publishing identity is selected/i)).toBeInTheDocument();
    expect(screen.queryByText("New Post")).not.toBeInTheDocument();
  });

  it("shows the create panel with the real destination once an identity is selected", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [image()] });
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/post.jpg", expiresAt: "2026-01-01T00:05:00Z" } });

    render(<SocialPostsView />);

    expect(await screen.findByText("New Post")).toBeInTheDocument();
    expect(screen.getByText("Publishing to Instagram: @amorebloom")).toBeInTheDocument();
  });

  it("renders exactly the images listSocialMediaAssetsAction returns — approved-JPEG filtering is now that action's own responsibility (see socialPostActions.test.ts), not this view's", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [image({ id: "jpeg_approved" })] });
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/x.jpg", expiresAt: "2026-01-01T00:05:00Z" } });

    render(<SocialPostsView />);
    await screen.findByText("New Post");

    expect(await screen.findAllByRole("button", { name: "post.jpg" })).toHaveLength(1);
  });

  it("saves a draft without publishing", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [image()] });
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
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [image()] });
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
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

    render(<SocialPostsView />);

    expect(await screen.findByText("Published")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "View on Instagram" });
    expect(link).toHaveAttribute("href", "https://www.instagram.com/p/abc123/");
  });

  it("never shows a permalink link when one isn't available", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "published", provider_permalink: null })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

    render(<SocialPostsView />);

    await screen.findByText("Published");
    expect(screen.queryByRole("link", { name: "View on Instagram" })).not.toBeInTheDocument();
  });

  it("shows a Retry button and the sanitized error for a failed post", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "failed", provider_error: "Reconnect Meta to enable publishing." })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

    render(<SocialPostsView />);

    expect(await screen.findByText("Reconnect Meta to enable publishing.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("never shows a Publish Now/Retry button for an already-published post", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "published" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

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
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

    render(<SocialPostsView />);
    await screen.findByText("Published");

    expect(screen.getAllByRole("button", { name: "Refresh insights" })).toHaveLength(1);
  });

  it("fetches and renders real metrics on Refresh insights — never a fabricated value", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "published" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });
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
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getSocialPostInsightsAction).mockResolvedValue({ success: true, data: { metrics: {} } });

    render(<SocialPostsView />);
    await user.click(await screen.findByRole("button", { name: "Refresh insights" }));

    expect(await screen.findByText("Insights may not be available yet.")).toBeInTheDocument();
  });

  it("shows the exact truthful error (e.g. reconnect-required) when insights fail — never renders stale/fabricated metrics", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "published" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getSocialPostInsightsAction).mockResolvedValue({ success: false, error: "Reconnect Meta to enable Instagram analytics." });

    render(<SocialPostsView />);
    await user.click(await screen.findByRole("button", { name: "Refresh insights" }));

    expect(await screen.findByText("Reconnect Meta to enable Instagram analytics.")).toBeInTheDocument();
  });
});

function setDialogDateTime(dateValue: string, timeValue: string) {
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Date"), { target: { value: dateValue } });
  fireEvent.change(within(dialog).getByLabelText("Time"), { target: { value: timeValue } });
}

describe("SocialPostsView — SOCIAL-04C scheduling", () => {
  it("shows a Schedule control for a draft post, adjacent to Publish Now", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "draft" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

    render(<SocialPostsView />);
    const postsList = await screen.findByRole("list");
    expect(within(postsList).getByRole("button", { name: "Schedule" })).toBeInTheDocument();
    expect(within(postsList).getByRole("button", { name: /publish now/i })).toBeInTheDocument();
  });

  it("opens the schedule dialog for an existing draft and calls scheduleSocialPostAction with a real UTC instant + resolved timezone", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ id: "p1", status: "draft" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(scheduleSocialPostAction).mockResolvedValue({ success: true, data: post({ id: "p1", status: "scheduled", scheduled_at: "2099-06-01T19:00:00.000Z", scheduled_timezone: "UTC" }) });

    render(<SocialPostsView />);
    const postsList = await screen.findByRole("list");
    await user.click(within(postsList).getByRole("button", { name: "Schedule" }));

    expect(screen.getByRole("dialog", { name: "Schedule post" })).toBeInTheDocument();
    setDialogDateTime("2099-06-01", "15:00");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Schedule" }));

    await waitFor(() => expect(scheduleSocialPostAction).toHaveBeenCalledTimes(1));
    const [id, input] = vi.mocked(scheduleSocialPostAction).mock.calls[0];
    expect(id).toBe("p1");
    expect(input.scheduledAt).toBe(new Date(2099, 5, 1, 15, 0, 0, 0).toISOString());
    expect(input.scheduledTimezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it("schedules a brand-new post from the composer without a separate creation flow — createSocialPostAction then scheduleSocialPostAction, exactly once each", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [image()] });
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: true, data: { url: "https://signed.example.com/post.jpg", expiresAt: "2026-01-01T00:05:00Z" } });
    vi.mocked(createSocialPostAction).mockResolvedValue({ success: true, data: post({ id: "new_post" }) });
    vi.mocked(scheduleSocialPostAction).mockResolvedValue({ success: true, data: post({ id: "new_post", status: "scheduled" }) });

    render(<SocialPostsView />);
    await user.click(await screen.findByRole("button", { name: "post.jpg" }));
    await user.click(screen.getByRole("button", { name: "Schedule" }));

    setDialogDateTime("2099-06-01", "15:00");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Schedule" }));

    await waitFor(() => expect(createSocialPostAction).toHaveBeenCalledWith({ caption: "", assetId: "asset_1" }));
    await waitFor(() => expect(scheduleSocialPostAction).toHaveBeenCalledWith("new_post", expect.any(Object)));
    expect(createSocialPostAction).toHaveBeenCalledTimes(1);
    expect(scheduleSocialPostAction).toHaveBeenCalledTimes(1);
    expect(publishSocialPostNowAction).not.toHaveBeenCalled();
  });

  it("displays 'Scheduled' with a humanized (never raw ISO) date/time after a successful schedule", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({
      success: true,
      data: [post({ status: "scheduled", scheduled_at: "2099-06-01T19:00:00.000Z", scheduled_timezone: "UTC" })],
    });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

    render(<SocialPostsView />);

    expect(await screen.findByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText(/Scheduled for/)).toBeInTheDocument();
    expect(screen.queryByText(/2099-06-01T19:00:00/)).not.toBeInTheDocument();
  });

  it("a controlled schedule failure releases the busy state and shows the exact error, without closing the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ id: "p1", status: "draft" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(scheduleSocialPostAction).mockResolvedValue({ success: false, error: "Only an approved image can be published." });

    render(<SocialPostsView />);
    const postsList = await screen.findByRole("list");
    await user.click(within(postsList).getByRole("button", { name: "Schedule" }));
    setDialogDateTime("2099-06-01", "15:00");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Schedule" }));

    expect(await screen.findByText("Only an approved image can be published.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Schedule" })).not.toBeDisabled();
  });

  it("Reschedule pre-populates the existing schedule and submits an updated UTC instant via rescheduleSocialPostAction", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({
      success: true,
      data: [post({ id: "p1", status: "scheduled", scheduled_at: "2099-06-01T15:00:00.000Z", scheduled_timezone: "UTC" })],
    });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(rescheduleSocialPostAction).mockResolvedValue({ success: true, data: post({ id: "p1", status: "scheduled", scheduled_at: "2099-07-01T15:00:00.000Z" }) });

    render(<SocialPostsView />);
    const postsList = await screen.findByRole("list");
    await user.click(within(postsList).getByRole("button", { name: "Reschedule" }));

    const dialog = screen.getByRole("dialog", { name: "Reschedule post" });
    expect((within(dialog).getByLabelText("Date") as HTMLInputElement).value).toBe("2099-06-01");
    expect((within(dialog).getByLabelText("Time") as HTMLInputElement).value).toBe("15:00");

    setDialogDateTime("2099-07-01", "15:00");
    await user.click(within(dialog).getByRole("button", { name: "Reschedule" }));

    await waitFor(() => expect(rescheduleSocialPostAction).toHaveBeenCalledTimes(1));
    const [id, input] = vi.mocked(rescheduleSocialPostAction).mock.calls[0];
    expect(id).toBe("p1");
    expect(input.scheduledAt).toBe(new Date(2099, 6, 1, 15, 0, 0, 0).toISOString());
  });

  it("Cancel schedule confirms, calls cancelSocialPostScheduleAction, and returns the post to Draft", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValueOnce({ success: true, data: [post({ id: "p1", status: "scheduled", scheduled_at: "2099-06-01T15:00:00.000Z" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(cancelSocialPostScheduleAction).mockResolvedValue({ success: true, data: post({ id: "p1", status: "draft" }) });
    vi.mocked(listSocialPostsAction).mockResolvedValueOnce({ success: true, data: [post({ id: "p1", status: "draft" })] });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<SocialPostsView />);
    const postsList = await screen.findByRole("list");
    await user.click(within(postsList).getByRole("button", { name: "Cancel schedule" }));

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(cancelSocialPostScheduleAction).toHaveBeenCalledWith("p1"));
    expect(await screen.findByText("Draft")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("Cancel schedule does nothing if the confirmation is declined — never calls the action", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ id: "p1", status: "scheduled", scheduled_at: "2099-06-01T15:00:00.000Z" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<SocialPostsView />);
    const postsList = await screen.findByRole("list");
    await user.click(within(postsList).getByRole("button", { name: "Cancel schedule" }));

    expect(cancelSocialPostScheduleAction).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("never labels schedule cancellation as Delete", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "scheduled", scheduled_at: "2099-06-01T15:00:00.000Z" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

    render(<SocialPostsView />);
    const postsList = await screen.findByRole("list");
    expect(within(postsList).queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("Publish Now remains available on a scheduled post and calls the same publishSocialPostNowAction", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ id: "p1", status: "scheduled", scheduled_at: "2099-06-01T15:00:00.000Z" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(publishSocialPostNowAction).mockResolvedValue({ success: true, data: post({ id: "p1", status: "published" }) });

    render(<SocialPostsView />);
    const postsList = await screen.findByRole("list");
    await user.click(within(postsList).getByRole("button", { name: /publish now/i }));

    await waitFor(() => expect(publishSocialPostNowAction).toHaveBeenCalledWith("p1"));
  });

  it("shows the deterministic result when the scheduler has already claimed a scheduled post — never an automatic client retry", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ id: "p1", status: "scheduled", scheduled_at: "2099-06-01T15:00:00.000Z" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(publishSocialPostNowAction).mockResolvedValue({ success: false, error: "This post is already publishing." });

    render(<SocialPostsView />);
    const postsList = await screen.findByRole("list");
    await user.click(within(postsList).getByRole("button", { name: /publish now/i }));

    expect(await screen.findByText("This post is already publishing.")).toBeInTheDocument();
    expect(publishSocialPostNowAction).toHaveBeenCalledTimes(1); // no automatic retry
  });

  it("Publishing state hides Schedule/Reschedule/Cancel and shows a clear 'Publishing…' indicator, never implying cancellation is still possible", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "publishing" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

    render(<SocialPostsView />);
    const postsList = await screen.findByRole("list");

    expect(within(postsList).getByText("Publishing…")).toBeInTheDocument();
    expect(within(postsList).queryByRole("button", { name: "Schedule" })).not.toBeInTheDocument();
    expect(within(postsList).queryByRole("button", { name: "Reschedule" })).not.toBeInTheDocument();
    expect(within(postsList).queryByRole("button", { name: "Cancel schedule" })).not.toBeInTheDocument();
    expect(within(postsList).queryByRole("button", { name: /publish now/i })).not.toBeInTheDocument();
  });

  it("Published state never shows Schedule/Reschedule/Cancel schedule controls", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "published" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

    render(<SocialPostsView />);
    const postsList = await screen.findByRole("list");
    await screen.findByText("Published");

    expect(within(postsList).queryByRole("button", { name: "Schedule" })).not.toBeInTheDocument();
    expect(within(postsList).queryByRole("button", { name: "Reschedule" })).not.toBeInTheDocument();
    expect(within(postsList).queryByRole("button", { name: "Cancel schedule" })).not.toBeInTheDocument();
  });

  it("a failed post with a pending durable retry shows a humanized 'Retry scheduled' hint, never a raw next_attempt_at timestamp or an attempt count", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({
      success: true,
      data: [post({ status: "failed", provider_error: "Instagram is rate-limiting requests right now. Try again in a few minutes.", next_attempt_at: "2099-06-01T15:05:00.000Z", scheduled_timezone: "UTC", publish_attempts: 2 })],
    });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

    render(<SocialPostsView />);

    expect(await screen.findByText(/Retry scheduled for/)).toBeInTheDocument();
    expect(screen.queryByText(/attempt #?2/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/2099-06-01T15:05:00/)).not.toBeInTheDocument();
  });

  it("a failed post still offers Schedule to explicitly re-enter the scheduling flow", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ status: "failed", provider_error: "Reconnect Meta to enable publishing." })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

    render(<SocialPostsView />);
    const postsList = await screen.findByRole("list");
    expect(within(postsList).getByRole("button", { name: "Schedule" })).toBeInTheDocument();
    expect(within(postsList).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("cancel schedule is protected against double submission — the button disables immediately", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ id: "p1", status: "scheduled", scheduled_at: "2099-06-01T15:00:00.000Z" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: IDENTITY });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });
    let resolveCancel: (value: { success: true; data: SocialPost }) => void = () => {};
    vi.mocked(cancelSocialPostScheduleAction).mockReturnValue(new Promise((resolve) => (resolveCancel = resolve)));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<SocialPostsView />);
    const postsList = await screen.findByRole("list");
    await user.click(within(postsList).getByRole("button", { name: "Cancel schedule" }));

    expect(within(postsList).getByRole("button", { name: "Cancelling…" })).toBeDisabled();

    resolveCancel({ success: true, data: post({ id: "p1", status: "draft" }) });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancelling…" })).not.toBeInTheDocument());
    confirmSpy.mockRestore();
  });
});

describe("SocialPostsView — SOCIAL-LIVE-01B load-failure handling", () => {
  it("an unexpected rejection during the initial load exits the loading state and renders the existing controlled ErrorState, with no unhandled rejection", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(listSocialMediaAssetsAction).mockRejectedValue(new Error("invalid input syntax for type uuid"));

    render(<SocialPostsView />);

    expect(await screen.findByText("Could not load Social Posts.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    // Getting here at all (Vitest fails the run on an unhandled rejection)
    // is itself proof the rejection was caught, not just left to reject.
  });

  it("reload() (the ErrorState's own Try again) also handles a rejection safely, staying in the controlled ErrorState rather than hanging", async () => {
    const user = userEvent.setup();
    // First load: a controlled (non-throwing) failure, reaching the existing ErrorState via its own established path.
    vi.mocked(listSocialPostsAction).mockResolvedValueOnce({ success: false, error: "Something went wrong. Please try again." });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

    render(<SocialPostsView />);
    await screen.findByText("Could not load Social Posts.");

    // Second load, triggered by the ErrorState's own "Try again" (== reload()): this time the previously-defective call rejects unexpectedly.
    vi.mocked(listSocialPostsAction).mockResolvedValueOnce({ success: true, data: [] });
    vi.mocked(listSocialMediaAssetsAction).mockRejectedValueOnce(new Error("invalid input syntax for type uuid"));
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Could not load Social Posts.")).toBeInTheDocument();
  });
});

describe("SocialPostsView — SOCIAL-LIVE-01A static regression guard", () => {
  it("never imports CURRENT_WORKSPACE_ID — the Social panel's own asset load must derive its workspace id entirely server-side via listSocialMediaAssetsAction, never a mock-mode placeholder constant", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await fs.readFile(path.resolve(__dirname, "SocialPostsView.tsx"), "utf-8");
    // Checks the actual `import ... from "@/lib/data"` statement's own
    // named-import list, not prose mentioning either identifier by name
    // (this file's own doc comments explain the historical bug using those
    // exact names, which is legitimate and not a regression). TypeScript
    // itself already proves a bare, unimported call/reference couldn't
    // compile, so checking the import statement is both necessary and
    // sufficient.
    const dataImportMatch = /import\s*\{([^}]*)\}\s*from\s*["']@\/lib\/data["']/.exec(source);
    expect(dataImportMatch).not.toBeNull();
    expect(dataImportMatch?.[1]).not.toMatch(/\blistMediaAssetsForWorkspace\b/);
    expect(source).not.toMatch(/from ["']@\/core\/constants\/workspace["']/);
  });
});

describe("SocialPostsView — SOCIAL-04D Feed Preview", () => {
  it("shows a Feed Preview tab alongside Posts", async () => {
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

    render(<SocialPostsView />);
    await screen.findByText("No social posts yet.");

    expect(screen.getByRole("tab", { name: "Posts" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Feed Preview" })).toBeInTheDocument();
  });

  it("switches from Posts to Feed Preview and back, rendering the same underlying posts either way", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction).mockResolvedValue({ success: true, data: [post({ id: "p1", status: "draft", caption: "Shared caption" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });

    render(<SocialPostsView />);
    const postsPanel = await screen.findByRole("tabpanel");
    expect(within(postsPanel).getByText("Shared caption")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Feed Preview" }));
    const feedPanel = screen.getByRole("tabpanel");
    expect(within(feedPanel).getByRole("button", { name: /draft: shared caption/i })).toBeInTheDocument();
    expect(within(feedPanel).queryByText("No social posts yet.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Posts" }));
    expect(screen.getByText("Shared caption")).toBeInTheDocument();
  });

  it("an action taken from the Feed Preview detail refreshes both views through the same reload mechanism — no duplicated canonical state", async () => {
    const user = userEvent.setup();
    vi.mocked(listSocialPostsAction)
      .mockResolvedValueOnce({ success: true, data: [post({ id: "p1", status: "draft" })] })
      .mockResolvedValue({ success: true, data: [post({ id: "p1", status: "published" })] });
    vi.mocked(getSelectedMetaPublishingIdentityAction).mockResolvedValue({ success: true, data: null });
    vi.mocked(listSocialMediaAssetsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(publishSocialPostNowAction).mockResolvedValue({ success: true, data: post({ id: "p1", status: "published" }) });

    render(<SocialPostsView />);
    await user.click(await screen.findByRole("tab", { name: "Feed Preview" }));
    await user.click(screen.getByRole("button", { name: /draft/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Publish Now" }));

    await waitFor(() => expect(publishSocialPostNowAction).toHaveBeenCalledWith("p1"));
    await user.click(screen.getByRole("tab", { name: "Posts" }));
    expect(await screen.findByText("Published")).toBeInTheDocument();
  });
});
