"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { listSocialPosts, listLatestSocialPostMetricSnapshotsForWorkspace, listSocialAccountMetricSnapshots } from "@/lib/data";
import { getOwnProviderConnectionAction } from "@/modules/integrations/manageOAuthConnectionActions";
import type { SocialPost } from "@/types/socialPost";
import type { SocialAccountMetricSnapshot, SocialPostMetricSnapshot } from "@/types/socialMetricSnapshot";

/**
 * SOCIAL-05E — the Analytics tab's own read model. Reads ONLY the
 * persisted snapshot tables SOCIAL-05C/05D already own — never calls Meta,
 * never triggers a sync, never changes `getSocialPostInsightsAction`'s own
 * on-demand behavior. Workspace id is derived server-side from the
 * caller's own session (`resolveMemberSessionSnapshot`), exactly like
 * every other Social action — the browser never supplies it (this is the
 * exact defect class SOCIAL-LIVE-01B fixed elsewhere; this file never
 * repeats it).
 */

type Result<T> = { success: true; data: T } | { success: false; error: string };
const GENERIC_ACCESS_ERROR = "That isn't available. You may not have access to it.";

type ActiveSessionResult =
  | { success: false; error: string }
  | { success: true; session: Awaited<ReturnType<typeof resolveMemberSessionSnapshot>> & { kind: "active" } };

async function requireActiveSession(permission: "social.view"): Promise<ActiveSessionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes(permission)) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, session };
}

export type SocialAnalyticsTimeRange = "7d" | "30d" | "90d";

const RANGE_DAYS: Record<SocialAnalyticsTimeRange, number> = { "7d": 7, "30d": 30, "90d": 90 };

export interface SocialPostPerformanceRow {
  post: SocialPost;
  /** Null means no snapshot has ever been captured for this post — never a fabricated zero row. */
  snapshot: SocialPostMetricSnapshot | null;
}

/** Narrows `snapshot`/`total_interactions` to non-null at the type level — exactly the invariant `topPosts` below actually guarantees at runtime (only posts with a real total_interactions are ever ranked), so the UI never needs an unsafe assertion to read it. */
export interface RankedSocialPostPerformanceRow {
  post: SocialPost;
  snapshot: SocialPostMetricSnapshot & { total_interactions: number };
}

export interface SocialAnalyticsDashboardData {
  /** True when the workspace has ever published a post, regardless of the selected range — distinguishes "no posts at all" from "no posts in this range" for the empty-state UI (Phase 12's cases C vs. B). */
  hasAnyPublishedPosts: boolean;
  /** The workspace's currently selected Instagram account id, if any — null when Meta isn't connected or no account is selected, in which case account-level sections show an empty state rather than an error. */
  instagramAccountId: string | null;
  accountLatest: SocialAccountMetricSnapshot | null;
  /** Ascending by metric_date (chart-ready), filtered to the requested range. */
  accountHistory: SocialAccountMetricSnapshot[];
  /** Every published post whose published_at falls within the requested range, each paired with its latest snapshot (or null if never synced). */
  postPerformance: SocialPostPerformanceRow[];
  /** Deterministic ranking: total_interactions descending, tied-break by published_at descending. Only posts with a real (non-null) total_interactions are ranked — Phase 9's own "do not invent a fallback" instruction. */
  topPosts: RankedSocialPostPerformanceRow[];
  freshness: {
    /** The latest account snapshot's own metric_date, regardless of the selected range — freshness is a global fact, not scoped to the current view. */
    accountAsOf: string | null;
    /** The latest snapshot_date across every published post's snapshot, regardless of range. */
    postAsOf: string | null;
  };
}

const TOP_POSTS_LIMIT = 5;

function rangeStartIso(range: SocialAnalyticsTimeRange): string {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - RANGE_DAYS[range]);
  return start.toISOString();
}

function rangeStartDate(range: SocialAnalyticsTimeRange): string {
  return rangeStartIso(range).slice(0, 10);
}

function latestDate(dates: (string | null)[]): string | null {
  return dates.reduce<string | null>((max, date) => (date && (!max || date > max) ? date : max), null);
}

export async function getSocialAnalyticsDashboardAction(range: SocialAnalyticsTimeRange = "30d"): Promise<Result<SocialAnalyticsDashboardData>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;
  const workspaceId = resolved.session.workspace.id;

  try {
    const [allPosts, identity] = await Promise.all([listSocialPosts(workspaceId), getOwnProviderConnectionAction("meta")]);

    const publishedPosts = allPosts.filter((post) => post.status === "published");
    // One bounded query for every published post's latest snapshot (Phase
    // 18 — never one call per post), regardless of the selected range, so
    // freshness always reflects the true latest sync activity.
    const snapshots = await listLatestSocialPostMetricSnapshotsForWorkspace(
      workspaceId,
      publishedPosts.map((post) => post.id),
    );
    const snapshotByPostId = new Map(snapshots.map((snapshot) => [snapshot.social_post_id, snapshot]));

    const rangeStart = rangeStartIso(range);
    const postsInRange = publishedPosts.filter((post) => post.published_at !== null && post.published_at >= rangeStart);
    const postPerformance: SocialPostPerformanceRow[] = postsInRange.map((post) => ({ post, snapshot: snapshotByPostId.get(post.id) ?? null }));

    const topPosts = postPerformance
      .filter((row): row is RankedSocialPostPerformanceRow => row.snapshot !== null && row.snapshot.total_interactions !== null)
      .sort((a, b) => {
        const byInteractions = b.snapshot.total_interactions - a.snapshot.total_interactions;
        if (byInteractions !== 0) return byInteractions;
        return (b.post.published_at ?? "").localeCompare(a.post.published_at ?? "");
      })
      .slice(0, TOP_POSTS_LIMIT);

    const instagramAccountId = identity.success && identity.data && typeof identity.data.config.meta_instagram_account_id === "string" ? identity.data.config.meta_instagram_account_id : null;

    let accountLatest: SocialAccountMetricSnapshot | null = null;
    let accountHistory: SocialAccountMetricSnapshot[] = [];
    if (instagramAccountId) {
      const fullAccountHistory = await listSocialAccountMetricSnapshots(workspaceId, instagramAccountId);
      accountLatest = fullAccountHistory[0] ?? null;
      const startDate = rangeStartDate(range);
      accountHistory = fullAccountHistory.filter((snapshot) => snapshot.metric_date >= startDate).sort((a, b) => a.metric_date.localeCompare(b.metric_date));
    }

    return {
      success: true,
      data: {
        hasAnyPublishedPosts: publishedPosts.length > 0,
        instagramAccountId,
        accountLatest,
        accountHistory,
        postPerformance,
        topPosts,
        freshness: {
          accountAsOf: accountLatest?.metric_date ?? null,
          postAsOf: latestDate(snapshots.map((snapshot) => snapshot.snapshot_date)),
        },
      },
    };
  } catch {
    return { success: false, error: "Could not load Social analytics." };
  }
}
