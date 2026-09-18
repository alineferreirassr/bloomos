"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getServerRepositoryContext } from "@/lib/auth/workspaceSession";
import { getDataMode } from "@/lib/env";
import { listSocialPosts, listLatestSocialPostMetricSnapshotsForWorkspace, listSocialAccountMetricSnapshots } from "@/lib/data";
import { getOwnProviderConnectionAction } from "@/modules/integrations/manageOAuthConnectionActions";
import { getSocialAttributionReport } from "@/modules/socialAttribution/getSocialAttributionReport";
import type { SocialPost } from "@/types/socialPost";
import type { SocialAccountMetricSnapshot, SocialPostMetricSnapshot } from "@/types/socialMetricSnapshot";
import type { SocialPostAttributionStats, SocialCommentAttributionStats, SocialConversationAttributionStats } from "@/modules/socialAttribution/types";

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

/**
 * SOCIAL-15E — the redacted, client-facing shape of `SocialPostAttributionStats`.
 * `leadCount`/`clientCount`/`eventCount` are never sensitive (plain
 * counts, no dollar figure) and are always real; `invoicedRevenueMinor`/
 * `paidRevenueMinor` are `null` for a caller lacking `finance.amounts.view`
 * — the exact same redaction discipline `financeActions.ts`'s own
 * `getFinanceDashboardDataAction` already applies to every other
 * money-bearing figure. Without this, a Staff member (real permission
 * matrix: `social.view` without `finance.amounts.view`) could see raw
 * attributed revenue through Social Analytics despite it being correctly
 * hidden from them on the Finance Dashboard — the exact bypass this type
 * exists to close.
 */
export interface SocialPostAttributionView {
  socialPostId: string;
  leadCount: number;
  clientCount: number;
  eventCount: number;
  invoicedRevenueMinor: number | null;
  paidRevenueMinor: number | null;
}

/**
 * SOCIAL-20D — the redacted, client-facing shape of `SocialCommentAttributionStats`/
 * `SocialConversationAttributionStats`, mirroring `SocialPostAttributionView`'s
 * own redaction discipline exactly. Ids only — never a comment's own
 * `content` or any username/participant identifier (see the source
 * types' own doc comments).
 */
export interface SocialCommentAttributionView {
  instagramCommentId: string;
  socialPostId: string | null;
  leadCount: number;
  clientCount: number;
  eventCount: number;
  invoicedRevenueMinor: number | null;
  paidRevenueMinor: number | null;
}

export interface SocialConversationAttributionView {
  instagramConversationId: string;
  leadCount: number;
  clientCount: number;
  eventCount: number;
  invoicedRevenueMinor: number | null;
  paidRevenueMinor: number | null;
}

/** The zero-stats default for a post with no entry in `getSocialAttributionReport()`'s own `byPost` — a real, honest zero (no attributed Lead exists), never a placeholder standing in for missing data. Money fields are redacted the same way as every other row via `redactAttribution`. */
function zeroAttribution(socialPostId: string): SocialPostAttributionStats {
  return { socialPostId, leadCount: 0, clientCount: 0, eventCount: 0, invoicedRevenueMinor: 0, paidRevenueMinor: 0 };
}

/** SOCIAL-15E / SOCIAL-20D — shared redaction core for every attribution row shape in this file: counts always real, money fields `null` (never `0`) for a caller lacking `finance.amounts.view`. */
function redactMoneyFields(
  stats: { leadCount: number; clientCount: number; eventCount: number; invoicedRevenueMinor: number; paidRevenueMinor: number },
  canViewAmounts: boolean,
): { leadCount: number; clientCount: number; eventCount: number; invoicedRevenueMinor: number | null; paidRevenueMinor: number | null } {
  return {
    leadCount: stats.leadCount,
    clientCount: stats.clientCount,
    eventCount: stats.eventCount,
    invoicedRevenueMinor: canViewAmounts ? stats.invoicedRevenueMinor : null,
    paidRevenueMinor: canViewAmounts ? stats.paidRevenueMinor : null,
  };
}

/** SOCIAL-15E — redacts money fields for a caller without `finance.amounts.view`; counts are always passed through real. */
function redactAttribution(stats: SocialPostAttributionStats, canViewAmounts: boolean): SocialPostAttributionView {
  return { socialPostId: stats.socialPostId, ...redactMoneyFields(stats, canViewAmounts) };
}

/** SOCIAL-20D — same redaction discipline as `redactAttribution`, applied to a `byComment` row. */
function redactCommentAttribution(stats: SocialCommentAttributionStats, canViewAmounts: boolean): SocialCommentAttributionView {
  return { instagramCommentId: stats.instagramCommentId, socialPostId: stats.socialPostId, ...redactMoneyFields(stats, canViewAmounts) };
}

/** SOCIAL-20D — same redaction discipline as `redactAttribution`, applied to a `byConversation` row. */
function redactConversationAttribution(stats: SocialConversationAttributionStats, canViewAmounts: boolean): SocialConversationAttributionView {
  return { instagramConversationId: stats.instagramConversationId, ...redactMoneyFields(stats, canViewAmounts) };
}

export interface SocialPostPerformanceRow {
  post: SocialPost;
  /** Null means no snapshot has ever been captured for this post — never a fabricated zero row. */
  snapshot: SocialPostMetricSnapshot | null;
  /**
   * SOCIAL-15D — stored attribution only, never inferred from engagement.
   * Deliberately all-time (not filtered by this action's own `range`
   * selector) — matches the Finance Dashboard's own all-time convention
   * for its comparable "Total Invoiced"/"Total Collected" cards, and
   * avoids silently mixing this row's own engagement-metric date window
   * with a completely different attribution date dimension.
   *
   * SOCIAL-15E — money fields redacted server-side (see
   * `SocialPostAttributionView`) for a caller without `finance.amounts.view`.
   */
  attribution: SocialPostAttributionView;
}

/** Narrows `snapshot`/`total_interactions` to non-null at the type level — exactly the invariant `topPosts` below actually guarantees at runtime (only posts with a real total_interactions are ever ranked), so the UI never needs an unsafe assertion to read it. */
export interface RankedSocialPostPerformanceRow {
  post: SocialPost;
  snapshot: SocialPostMetricSnapshot & { total_interactions: number };
  attribution: SocialPostAttributionView;
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
  /**
   * SOCIAL-20D — one row per comment with at least one attributed Lead
   * (`getSocialAttributionReport()`'s own `byComment`, redacted). All-time,
   * exactly like `postPerformance[*].attribution` — never filtered by this
   * action's own `range` selector. Overlaps `postPerformance`'s own
   * attribution figures for any post-resolved comment; never additive with
   * it (see `SocialAttributionReport.byComment`'s own doc comment).
   */
  commentAttribution: SocialCommentAttributionView[];
  /** SOCIAL-20D — one row per DM conversation with at least one attributed Lead (`byConversation`, redacted). All-time, disjoint from `postPerformance`/`commentAttribution`. */
  conversationAttribution: SocialConversationAttributionView[];
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
  // SOCIAL-15E — Social Analytics is reachable with only `social.view`
  // (e.g. the real Staff role), which does not imply `finance.amounts.view`.
  // Money fields below are redacted server-side via `redactAttribution` so
  // this permission is enforced at the data layer, not only in the UI.
  const canViewAmounts = resolved.session.permissions.includes("finance.amounts.view");

  try {
    // SOCIAL-16H.1 — resolved exactly once, here at the genuine Server
    // Action boundary (this file is "use server", never bundled for the
    // client), and threaded through to getSocialAttributionReport()'s own
    // five concurrent repository calls. Each of those otherwise falls back
    // to independently resolving its own session via the browser-oriented
    // getClientWorkspaceSession(), which can spuriously report
    // "unauthenticated" under concurrent invocation even for a genuinely
    // signed-in caller — the exact, confirmed cause of SOCIAL-16G's Social
    // Analytics load failure. getSocialAttributionReport() itself must
    // never resolve this context on its own: it (and the repository
    // functions it calls) is reachable from client-bundled code elsewhere
    // in the app, and `getServerRepositoryContext()` depends on
    // `next/headers`, which can never appear in that import graph.
    const context = getDataMode() === "supabase" ? await getServerRepositoryContext() : undefined;
    const [allPosts, identity, attributionReport] = await Promise.all([
      listSocialPosts(workspaceId),
      getOwnProviderConnectionAction("meta"),
      getSocialAttributionReport(context),
    ]);
    const attributionByPostId = new Map(attributionReport.byPost.map((stats) => [stats.socialPostId, stats]));
    // SOCIAL-20D — all-time, exactly like attributionByPostId above; never
    // filtered by `range`.
    const commentAttribution = attributionReport.byComment.map((stats) => redactCommentAttribution(stats, canViewAmounts));
    const conversationAttribution = attributionReport.byConversation.map((stats) => redactConversationAttribution(stats, canViewAmounts));

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
    const postPerformance: SocialPostPerformanceRow[] = postsInRange.map((post) => ({
      post,
      snapshot: snapshotByPostId.get(post.id) ?? null,
      attribution: redactAttribution(attributionByPostId.get(post.id) ?? zeroAttribution(post.id), canViewAmounts),
    }));

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
        commentAttribution,
        conversationAttribution,
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
