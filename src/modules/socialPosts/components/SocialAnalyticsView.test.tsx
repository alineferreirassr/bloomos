import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/socialPosts/socialAnalyticsActions", () => ({
  getSocialAnalyticsDashboardAction: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getMediaAssetDownloadUrl: vi.fn(),
}));

import { getSocialAnalyticsDashboardAction } from "@/modules/socialPosts/socialAnalyticsActions";
import { getMediaAssetDownloadUrl } from "@/lib/data";
import { SocialAnalyticsView } from "@/modules/socialPosts/components/SocialAnalyticsView";
import type { SocialAnalyticsDashboardData } from "@/modules/socialPosts/socialAnalyticsActions";
import type { SocialPost } from "@/types/socialPost";

function post(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "post_1",
    workspace_id: "ws_1",
    created_by: "member_1",
    status: "published",
    caption: "Hello!",
    asset_id: "asset_1",
    target_provider: "meta",
    target_connection_id: "conn_1",
    target_page_id: "page_1",
    target_instagram_account_id: "ig_1",
    provider_container_id: null,
    provider_post_id: "17900000000000001",
    provider_permalink: null,
    provider_error: null,
    published_at: "2026-09-17T00:00:00Z",
    scheduled_at: null,
    scheduled_timezone: null,
    publish_attempts: 0,
    next_attempt_at: null,
    created_at: "2026-09-17T00:00:00Z",
    updated_at: "2026-09-17T00:00:00Z",
    ...overrides,
  };
}

function emptyData(overrides: Partial<SocialAnalyticsDashboardData> = {}): SocialAnalyticsDashboardData {
  return {
    hasAnyPublishedPosts: false,
    instagramAccountId: null,
    accountLatest: null,
    accountHistory: [],
    postPerformance: [],
    topPosts: [],
    freshness: { accountAsOf: null, postAsOf: null },
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("SocialAnalyticsView — loading/error/retry", () => {
  it("shows a loading skeleton before the fetch resolves", () => {
    vi.mocked(getSocialAnalyticsDashboardAction).mockReturnValue(new Promise(() => {}));
    render(<SocialAnalyticsView />);
    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
  });

  it("shows a controlled error state on failure, with a working retry", async () => {
    const user = userEvent.setup();
    vi.mocked(getSocialAnalyticsDashboardAction).mockResolvedValueOnce({ success: false, error: "Could not load Social analytics." }).mockResolvedValueOnce({ success: true, data: emptyData() });

    render(<SocialAnalyticsView />);
    expect(await screen.findByText("Could not load Social analytics.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Overview")).toBeInTheDocument();
  });
});

describe("SocialAnalyticsView — empty states", () => {
  it("shows 'no published posts yet' when the workspace has never published anything", async () => {
    vi.mocked(getSocialAnalyticsDashboardAction).mockResolvedValue({ success: true, data: emptyData() });
    render(<SocialAnalyticsView />);
    expect(await screen.findByText("No published posts yet")).toBeInTheDocument();
  });

  it("distinguishes 'no posts in this range' from 'no posts at all'", async () => {
    vi.mocked(getSocialAnalyticsDashboardAction).mockResolvedValue({ success: true, data: emptyData({ hasAnyPublishedPosts: true }) });
    render(<SocialAnalyticsView />);
    expect(await screen.findByText("No posts published in this range")).toBeInTheDocument();
  });

  it("prompts to connect Meta when no Instagram account is selected", async () => {
    vi.mocked(getSocialAnalyticsDashboardAction).mockResolvedValue({ success: true, data: emptyData() });
    render(<SocialAnalyticsView />);
    expect(await screen.findByText("Connect Meta to see account trends")).toBeInTheDocument();
  });

  it("distinguishes 'no account data synced yet' from 'no account data in this range'", async () => {
    vi.mocked(getSocialAnalyticsDashboardAction).mockResolvedValue({
      success: true,
      data: emptyData({ instagramAccountId: "ig_1", accountLatest: { id: "s1", workspace_id: "ws_1", instagram_account_id: "ig_1", metric_date: "2026-08-01", reach: 10, profile_views: null, raw_metrics: {}, created_at: "2026-08-01T00:00:00Z" } }),
    });
    render(<SocialAnalyticsView />);
    expect(await screen.findByText("No account data in this range")).toBeInTheDocument();
  });

  it("shows 'no ranked posts yet' when nothing has a real total_interactions", async () => {
    vi.mocked(getSocialAnalyticsDashboardAction).mockResolvedValue({ success: true, data: emptyData({ hasAnyPublishedPosts: true, postPerformance: [{ post: post(), snapshot: null }] }) });
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not needed" });
    render(<SocialAnalyticsView />);
    expect(await screen.findByText("No ranked posts yet")).toBeInTheDocument();
  });
});

describe("SocialAnalyticsView — KPIs, null vs zero", () => {
  it("renders '—' for an unavailable KPI and a real number for a present one, never coercing null to 0", async () => {
    vi.mocked(getSocialAnalyticsDashboardAction).mockResolvedValue({
      success: true,
      data: emptyData({
        instagramAccountId: "ig_1",
        accountLatest: { id: "s1", workspace_id: "ws_1", instagram_account_id: "ig_1", metric_date: "2026-09-17", reach: 500, profile_views: null, raw_metrics: {}, created_at: "2026-09-17T00:00:00Z" },
      }),
    });
    render(<SocialAnalyticsView />);
    await screen.findByText("Overview");

    const reachCard = screen.getByText("Account Reach").closest("div");
    expect(within(reachCard!).getByText("500")).toBeInTheDocument();
    const profileViewsCard = screen.getByText("Profile Views").closest("div");
    expect(within(profileViewsCard!).getByText("—")).toBeInTheDocument();
  });

  it("renders a real zero KPI as 0, not as unavailable", async () => {
    vi.mocked(getSocialAnalyticsDashboardAction).mockResolvedValue({
      success: true,
      data: emptyData({
        hasAnyPublishedPosts: true,
        postPerformance: [{ post: post(), snapshot: { id: "sp1", workspace_id: "ws_1", social_post_id: "post_1", provider_media_id: "p", captured_at: "2026-09-17T00:00:00Z", snapshot_date: "2026-09-17", views: null, reach: 0, likes: null, comments: null, shares: null, saved: null, total_interactions: null, raw_metrics: {}, created_at: "2026-09-17T00:00:00Z" } }],
      }),
    });
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not needed" });
    render(<SocialAnalyticsView />);
    await screen.findByText("Overview");

    const postReachCard = screen.getByText("Post Reach").closest("div");
    expect(within(postReachCard!).getByText("0")).toBeInTheDocument();
  });
});

describe("SocialAnalyticsView — post performance and top posts", () => {
  it("renders the post-performance table with metric cells, showing '—' for null metrics", async () => {
    vi.mocked(getSocialAnalyticsDashboardAction).mockResolvedValue({
      success: true,
      data: emptyData({
        hasAnyPublishedPosts: true,
        postPerformance: [{ post: post({ caption: "Golden hour" }), snapshot: { id: "sp1", workspace_id: "ws_1", social_post_id: "post_1", provider_media_id: "p", captured_at: "2026-09-17T00:00:00Z", snapshot_date: "2026-09-17", views: null, reach: 250, likes: 12, comments: null, shares: null, saved: null, total_interactions: null, raw_metrics: {}, created_at: "2026-09-17T00:00:00Z" } }],
      }),
    });
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not needed" });
    render(<SocialAnalyticsView />);

    expect(await screen.findByText("Golden hour")).toBeInTheDocument();
    const row = screen.getByText("Golden hour").closest("tr")!;
    expect(within(row).getByText("250")).toBeInTheDocument();
    expect(within(row).getByText("12")).toBeInTheDocument();
    expect(within(row).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("ranks top posts in the exact order the read model already provides — deterministic, not re-sorted by the UI", async () => {
    vi.mocked(getSocialAnalyticsDashboardAction).mockResolvedValue({
      success: true,
      data: emptyData({
        hasAnyPublishedPosts: true,
        topPosts: [
          { post: post({ id: "p_high", caption: "Top post" }), snapshot: { id: "s1", workspace_id: "ws_1", social_post_id: "p_high", provider_media_id: "p", captured_at: "x", snapshot_date: "2026-09-17", views: null, reach: null, likes: null, comments: null, shares: null, saved: null, total_interactions: 50, raw_metrics: {}, created_at: "x" } },
          { post: post({ id: "p_low", caption: "Second post" }), snapshot: { id: "s2", workspace_id: "ws_1", social_post_id: "p_low", provider_media_id: "p", captured_at: "x", snapshot_date: "2026-09-17", views: null, reach: null, likes: null, comments: null, shares: null, saved: null, total_interactions: 5, raw_metrics: {}, created_at: "x" } },
        ],
      }),
    });
    vi.mocked(getMediaAssetDownloadUrl).mockResolvedValue({ success: false, error: "not needed" });
    render(<SocialAnalyticsView />);

    const items = await screen.findAllByRole("listitem");
    expect(within(items[0]).getByText("Top post")).toBeInTheDocument();
    expect(within(items[0]).getByText("50 interactions")).toBeInTheDocument();
    expect(within(items[1]).getByText("Second post")).toBeInTheDocument();
  });
});

describe("SocialAnalyticsView — account trend and freshness", () => {
  it("renders the account trend charts with an accessible text equivalent per point", async () => {
    vi.mocked(getSocialAnalyticsDashboardAction).mockResolvedValue({
      success: true,
      data: emptyData({
        instagramAccountId: "ig_1",
        accountLatest: { id: "s1", workspace_id: "ws_1", instagram_account_id: "ig_1", metric_date: "2026-09-17", reach: 500, profile_views: 40, raw_metrics: {}, created_at: "x" },
        accountHistory: [{ id: "s1", workspace_id: "ws_1", instagram_account_id: "ig_1", metric_date: "2026-09-17", reach: 500, profile_views: 40, raw_metrics: {}, created_at: "x" }],
      }),
    });
    render(<SocialAnalyticsView />);
    await screen.findByText("Overview");
    expect(screen.getByRole("img", { name: "reach trend" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "profile views trend" })).toBeInTheDocument();
  });

  it("shows an 'as of' freshness label derived from the latest snapshot date", async () => {
    vi.mocked(getSocialAnalyticsDashboardAction).mockResolvedValue({
      success: true,
      data: emptyData({ freshness: { accountAsOf: "2026-09-17", postAsOf: "2026-09-16" } }),
    });
    render(<SocialAnalyticsView />);
    expect(await screen.findByText(/account data as of/i)).toBeInTheDocument();
    expect(screen.getByText(/post data as of/i)).toBeInTheDocument();
  });
});

describe("SocialAnalyticsView — time range selector", () => {
  it("re-fetches with the newly selected range", async () => {
    const user = userEvent.setup();
    vi.mocked(getSocialAnalyticsDashboardAction).mockResolvedValue({ success: true, data: emptyData() });
    render(<SocialAnalyticsView />);
    await screen.findByText("Overview");

    await user.click(screen.getByRole("button", { name: "7D" }));
    await waitFor(() => expect(getSocialAnalyticsDashboardAction).toHaveBeenCalledWith("7d"));
  });
});
