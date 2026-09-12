import type { SocialAccountMetricSnapshot, SocialPostMetricSnapshot } from "@/types/socialMetricSnapshot";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapSocialAccountMetricSnapshotRow, mapSocialPostMetricSnapshotRow } from "@/lib/supabase/mappers";
import type {
  SocialAnalyticsRepository,
  UpsertSocialAccountMetricSnapshotInput,
  UpsertSocialPostMetricSnapshotInput,
} from "@/lib/data/socialAnalytics/repository";

type SupabaseClient = ReturnType<typeof createSupabaseClient>;

const NOT_FOUND_ERROR = "This social post could not be found.";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * SOCIAL-05C — the FK alone (`social_post_id references social_posts`)
 * cannot prove a caller-supplied `workspaceId` actually matches the
 * referenced post's own `workspace_id` — this re-checks it explicitly,
 * mirroring `socialPostActions.ts`'s own `loadOwnedPost` pattern exactly,
 * before any insert is attempted.
 */
async function verifyOwnedSocialPost(supabase: SupabaseClient, socialPostId: string, workspaceId: string): Promise<boolean> {
  const { data, error } = await supabase.from("social_posts").select("id").eq("id", socialPostId).eq("workspace_id", workspaceId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data !== null;
}

/**
 * No `authenticated` INSERT policy exists on either snapshot table today
 * (least privilege — see the migration's own comment: the only intended
 * future writer is SOCIAL-05D's own service-role sync, which will bypass
 * RLS through a narrow boundary of its own, mirroring
 * `socialSchedulerServiceRole.ts`). This method is implemented and tested
 * for completeness and forward-compatibility, but calling it through an
 * ordinary authenticated session today is expected to fail at the
 * database layer until SOCIAL-05D decides on its actual write path.
 */
async function upsertSocialPostMetricSnapshot(input: UpsertSocialPostMetricSnapshotInput): Promise<DataResult<SocialPostMetricSnapshot>> {
  const supabase = createSupabaseClient();
  const owned = await verifyOwnedSocialPost(supabase, input.socialPostId, input.workspaceId);
  if (!owned) return fail(NOT_FOUND_ERROR);

  const snapshotDate = input.snapshotDate ?? todayIsoDate();
  const { data, error } = await supabase
    .from("social_post_metric_snapshots")
    .upsert(
      {
        workspace_id: input.workspaceId,
        social_post_id: input.socialPostId,
        provider_media_id: input.providerMediaId,
        snapshot_date: snapshotDate,
        views: input.metrics.views ?? null,
        reach: input.metrics.reach ?? null,
        likes: input.metrics.likes ?? null,
        comments: input.metrics.comments ?? null,
        shares: input.metrics.shares ?? null,
        saved: input.metrics.saved ?? null,
        total_interactions: input.metrics.total_interactions ?? null,
        raw_metrics: input.rawMetrics,
      },
      { onConflict: "social_post_id,snapshot_date" },
    )
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  return ok(mapSocialPostMetricSnapshotRow(data));
}

async function listSocialPostMetricSnapshots(workspaceId: string, socialPostId: string): Promise<SocialPostMetricSnapshot[]> {
  const supabase = createSupabaseClient();
  // Sorted by the logical snapshot_date, never captured_at — see
  // mockRepository.ts's identical listSocialPostMetricSnapshots for why.
  const { data, error } = await supabase
    .from("social_post_metric_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("social_post_id", socialPostId)
    .order("snapshot_date", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapSocialPostMetricSnapshotRow);
}

async function getLatestSocialPostMetricSnapshot(workspaceId: string, socialPostId: string): Promise<SocialPostMetricSnapshot | null> {
  const history = await listSocialPostMetricSnapshots(workspaceId, socialPostId);
  return history[0] ?? null;
}

/**
 * SOCIAL-05E — one bounded query for the dashboard's own post-performance
 * table (Phase 18's own explicit N+1 prohibition). Fetches every snapshot
 * for the given posts ordered by snapshot_date descending, then reduces in
 * application code to the first (= latest) row per social_post_id —
 * avoids a `DISTINCT ON` the Supabase query builder has no direct
 * equivalent for, without resorting to raw SQL.
 */
async function listLatestSocialPostMetricSnapshotsForWorkspace(workspaceId: string, socialPostIds: string[]): Promise<SocialPostMetricSnapshot[]> {
  if (socialPostIds.length === 0) return [];
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("social_post_metric_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("social_post_id", socialPostIds)
    .order("snapshot_date", { ascending: false });
  if (error) throw normalizeSupabaseError(error);

  const latestByPost = new Map<string, SocialPostMetricSnapshot>();
  for (const row of data ?? []) {
    if (!latestByPost.has(row.social_post_id)) latestByPost.set(row.social_post_id, mapSocialPostMetricSnapshotRow(row));
  }
  return [...latestByPost.values()];
}

async function upsertSocialAccountMetricSnapshot(input: UpsertSocialAccountMetricSnapshotInput): Promise<DataResult<SocialAccountMetricSnapshot>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("social_account_metric_snapshots")
    .upsert(
      {
        workspace_id: input.workspaceId,
        instagram_account_id: input.instagramAccountId,
        metric_date: input.metricDate,
        reach: input.metrics.reach ?? null,
        profile_views: input.metrics.profile_views ?? null,
        raw_metrics: input.rawMetrics,
      },
      { onConflict: "workspace_id,instagram_account_id,metric_date" },
    )
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  return ok(mapSocialAccountMetricSnapshotRow(data));
}

async function listSocialAccountMetricSnapshots(workspaceId: string, instagramAccountId: string): Promise<SocialAccountMetricSnapshot[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("social_account_metric_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("instagram_account_id", instagramAccountId)
    .order("metric_date", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapSocialAccountMetricSnapshotRow);
}

async function getLatestSocialAccountMetricSnapshot(workspaceId: string, instagramAccountId: string): Promise<SocialAccountMetricSnapshot | null> {
  const history = await listSocialAccountMetricSnapshots(workspaceId, instagramAccountId);
  return history[0] ?? null;
}

export const supabaseSocialAnalyticsRepository: SocialAnalyticsRepository = {
  upsertSocialPostMetricSnapshot,
  listSocialPostMetricSnapshots,
  getLatestSocialPostMetricSnapshot,
  listLatestSocialPostMetricSnapshotsForWorkspace,
  upsertSocialAccountMetricSnapshot,
  listSocialAccountMetricSnapshots,
  getLatestSocialAccountMetricSnapshot,
};
