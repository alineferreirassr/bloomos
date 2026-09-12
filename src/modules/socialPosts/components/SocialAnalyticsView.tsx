"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardGridSkeleton, TableSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { getMediaAssetDownloadUrl } from "@/lib/data";
import { getSocialAnalyticsDashboardAction, type SocialAnalyticsDashboardData, type SocialAnalyticsTimeRange, type SocialPostPerformanceRow } from "@/modules/socialPosts/socialAnalyticsActions";
import { SocialAnalyticsTrendChart } from "@/modules/socialPosts/components/SocialAnalyticsTrendChart";

/**
 * SOCIAL-05E — the Analytics tab. Reads ONLY persisted snapshot data via
 * `getSocialAnalyticsDashboardAction` (SOCIAL-05C/05D's own tables) — no
 * Meta call, no sync trigger, ever. Self-contained (owns its own
 * loading/error/range state) rather than folded into `SocialPostsView`'s
 * own state, so switching to this tab never blocks Posts/Feed Preview,
 * and — since `TabPanel` unmounts inactive panels (SOCIAL-04D's own
 * established convention) — this component's fetch only ever runs while
 * the tab is actually selected.
 */

const TIME_RANGES: { value: SocialAnalyticsTimeRange; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
];

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; data: SocialAnalyticsDashboardData };

function formatNumber(value: number): string {
  return value.toLocaleString();
}

/** Sums only the real (non-null) values — an entirely-null set (no post in range has this metric) returns null, never a fabricated 0, distinct from a real sum that happens to be 0. */
function sumOrNull(values: (number | null | undefined)[]): number | null {
  const real = values.filter((v): v is number => typeof v === "number");
  if (real.length === 0) return null;
  return real.reduce((total, v) => total + v, 0);
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

function formatPublishedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** KPI value cell — the shared "—" convention for an unavailable metric, never a coerced zero. */
function KpiCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card>
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className="mt-1.5 font-serif text-2xl font-semibold text-text">{value === null ? "—" : formatNumber(value)}</p>
    </Card>
  );
}

function MetricCell({ value }: { value: number | null }) {
  return <span className={value === null ? "text-text-muted" : "text-text"}>{value === null ? "—" : formatNumber(value)}</span>;
}

function PostThumbnail({ assetId, alt }: { assetId: string; alt: string }) {
  const [state, setState] = useState<{ forAssetId: string; url: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMediaAssetDownloadUrl(assetId).then((result) => {
      if (cancelled) return;
      setState({ forAssetId: assetId, url: result.success ? result.data.url : null });
    });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const current = state?.forAssetId === assetId ? state : null;

  if (current?.url) {
    // eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL, not a static asset Next can optimize
    return <img src={current.url} alt={alt} className="h-10 w-10 shrink-0 rounded-md object-cover" />;
  }
  return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-tint text-[9px] font-medium tracking-wide text-text-muted uppercase">N/A</div>;
}

export function SocialAnalyticsView() {
  const [range, setRange] = useState<SocialAnalyticsTimeRange>("30d");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // Mirrors ProfitabilityPanel.tsx's own established range-selector
  // pattern exactly: never resets to "loading" on a range change (only the
  // very first mount starts there) — a range switch keeps the previous
  // range's data visible until the new fetch resolves, then swaps
  // straight to "ready"/"error". Avoids a synchronous setState inside the
  // effect body (react-hooks/set-state-in-effect) by only ever calling
  // setState from the async .then() callback.
  function load(nextRange: SocialAnalyticsTimeRange) {
    getSocialAnalyticsDashboardAction(nextRange).then((result) => {
      setState(result.success ? { status: "ready", data: result.data } : { status: "error" });
    });
  }

  useEffect(() => {
    load(range);
  }, [range]);

  const rangeSelector = (
    <div role="group" aria-label="Time range" className="flex gap-1 rounded-md border border-border p-0.5">
      {TIME_RANGES.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={range === option.value}
          onClick={() => setRange(option.value)}
          className={`rounded px-2.5 py-1 font-serif text-[12px] font-semibold transition-colors duration-150 ${
            range === option.value ? "bg-accent text-white" : "text-text-muted hover:bg-text/7"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          {rangeSelector}
        </div>
        <CardGridSkeleton count={4} />
        <TableSkeleton rows={4} columns={6} />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load Social analytics." onRetry={() => load(range)} />;
  }

  const { data } = state;
  const accountReach = data.accountLatest?.reach ?? null;
  const profileViews = data.accountLatest?.profile_views ?? null;
  const postReach = sumOrNull(data.postPerformance.map((row) => row.snapshot?.reach));
  const totalInteractions = sumOrNull(data.postPerformance.map((row) => row.snapshot?.total_interactions));

  const freshnessParts = [data.freshness.accountAsOf ? `Account data as of ${formatDate(data.freshness.accountAsOf)}` : null, data.freshness.postAsOf ? `Post data as of ${formatDate(data.freshness.postAsOf)}` : null].filter(
    (part): part is string => part !== null,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-[17px] font-semibold text-text">Overview</h3>
          {freshnessParts.length > 0 ? <p className="mt-0.5 text-xs text-text-muted">{freshnessParts.join(" · ")}</p> : null}
        </div>
        {rangeSelector}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Account Reach" value={accountReach} />
        <KpiCard label="Profile Views" value={profileViews} />
        <KpiCard label="Post Reach" value={postReach} />
        <KpiCard label="Total Interactions" value={totalInteractions} />
      </div>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Account Trend</h3>
        {!data.instagramAccountId ? (
          <EmptyState title="Connect Meta to see account trends" description="Select an Instagram account under Settings → Integrations → Meta to unlock reach and profile-view history." />
        ) : data.accountHistory.length === 0 ? (
          <EmptyState
            title={data.accountLatest ? "No account data in this range" : "No account data synced yet"}
            description={data.accountLatest ? "Try a longer time range." : "Account analytics appear here once a sync has run."}
          />
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            <div>
              <p className="mb-1 text-xs font-medium text-text-muted">Reach</p>
              <SocialAnalyticsTrendChart points={data.accountHistory.filter((s) => s.reach !== null).map((s) => ({ date: s.metric_date, value: s.reach as number }))} label="reach" />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-muted">Profile Views</p>
              <SocialAnalyticsTrendChart points={data.accountHistory.filter((s) => s.profile_views !== null).map((s) => ({ date: s.metric_date, value: s.profile_views as number }))} label="profile views" />
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Top Posts</h3>
        {data.topPosts.length === 0 ? (
          <EmptyState title="No ranked posts yet" description="Posts appear here once Instagram reports total interactions for at least one published post." />
        ) : (
          <ol className="mt-3 flex flex-col gap-2">
            {data.topPosts.map((row, index) => (
              <li key={row.post.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                <span className="w-5 shrink-0 text-center font-serif text-sm font-semibold text-text-muted">{index + 1}</span>
                <PostThumbnail assetId={row.post.asset_id} alt={row.post.caption || "Social post image"} />
                <p className="min-w-0 flex-1 truncate text-sm text-text">{row.post.caption || "(no caption)"}</p>
                <Badge tone="accent">{formatNumber(row.snapshot.total_interactions as number)} interactions</Badge>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Post Performance</h3>
        {!data.hasAnyPublishedPosts ? (
          <EmptyState title="No published posts yet" description="Published posts and their performance will appear here." />
        ) : data.postPerformance.length === 0 ? (
          <EmptyState title="No posts published in this range" description="Try a longer time range." />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="py-2 pr-3 font-medium">Post</th>
                  <th className="py-2 pr-3 font-medium">Published</th>
                  <th className="py-2 pr-3 font-medium">Reach</th>
                  <th className="py-2 pr-3 font-medium">Views</th>
                  <th className="py-2 pr-3 font-medium">Likes</th>
                  <th className="py-2 pr-3 font-medium">Comments</th>
                  <th className="py-2 pr-3 font-medium">Shares</th>
                  <th className="py-2 pr-3 font-medium">Saved</th>
                  <th className="py-2 pr-3 font-medium">Interactions</th>
                </tr>
              </thead>
              <tbody>
                {data.postPerformance.map((row: SocialPostPerformanceRow) => (
                  <tr key={row.post.id} className="border-b border-border last:border-b-0">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2.5">
                        <PostThumbnail assetId={row.post.asset_id} alt={row.post.caption || "Social post image"} />
                        <span className="max-w-[220px] truncate text-text">{row.post.caption || "(no caption)"}</span>
                        {row.post.provider_permalink ? (
                          <a href={row.post.provider_permalink} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-accent underline">
                            View
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-text-muted">{row.post.published_at ? formatPublishedAt(row.post.published_at) : "—"}</td>
                    <td className="py-2.5 pr-3">
                      <MetricCell value={row.snapshot?.reach ?? null} />
                    </td>
                    <td className="py-2.5 pr-3">
                      <MetricCell value={row.snapshot?.views ?? null} />
                    </td>
                    <td className="py-2.5 pr-3">
                      <MetricCell value={row.snapshot?.likes ?? null} />
                    </td>
                    <td className="py-2.5 pr-3">
                      <MetricCell value={row.snapshot?.comments ?? null} />
                    </td>
                    <td className="py-2.5 pr-3">
                      <MetricCell value={row.snapshot?.shares ?? null} />
                    </td>
                    <td className="py-2.5 pr-3">
                      <MetricCell value={row.snapshot?.saved ?? null} />
                    </td>
                    <td className="py-2.5 pr-3">
                      <MetricCell value={row.snapshot?.total_interactions ?? null} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
