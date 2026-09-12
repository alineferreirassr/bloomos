import "server-only";
import { getLogger } from "@/core/observability/logger";
import { createServiceRoleClient, resolveWorkspaceAnalyticsContext } from "@/core/social/socialAnalyticsServiceRole";
import { MetaProvider, isMetaAuthError, isMetaRateLimitError } from "@/core/integrations/providers/meta/metaProvider";
import { sanitizeIntegrationError } from "@/core/integrations/errorSanitizer";
import { insertErrorRecord } from "@/lib/data/core/integrations/errorRecordStore";
import { mapSocialPostRow } from "@/lib/supabase/mappers";
import type { SocialPost } from "@/types/socialPost";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SOCIAL-05D — the background analytics sync's own orchestration, invoked
 * only from the CRON_SECRET-protected route
 * (`app/api/social/analytics/sync/route.ts`). Persists directly through
 * the service-role client — it deliberately does NOT reuse the SOCIAL-05C
 * interactive `SocialAnalyticsRepository` (every implementation of that
 * repository's Supabase side calls `createSupabaseClient()`, the
 * session-bound browser client, which this caller — no browser session —
 * can never satisfy), mirroring `scheduledPostExecutor.ts`'s own identical
 * choice not to reuse `SocialPostsRepository` for exactly the same reason.
 * The idempotency keys/columns it writes are the exact same ones SOCIAL-05C
 * already defined and tested: `(social_post_id, snapshot_date)` and
 * `(workspace_id, instagram_account_id, metric_date)`.
 *
 * Execution order (per workspace): resolve the Meta connection once, sync
 * the account snapshot first (cheap, single call), then iterate this
 * workspace's own eligible published posts — matching SOCIAL-05A's own
 * recommended ordering. One post's failure never aborts its siblings; one
 * workspace's connection/credential failure never aborts another
 * workspace — every unit of work is caught and classified independently.
 *
 * `IntegrationConnection.last_sync_at`/`failure_count`/`retry_count` are
 * deliberately left untouched by this checkpoint: their current semantics
 * elsewhere in this codebase are ambiguous for a second, unrelated sync
 * concern sharing the same connection row, and repository reality (not a
 * convenient reuse) must decide that — a future checkpoint can revisit
 * this explicitly if it proves necessary.
 */

const INSTAGRAM_IMAGE_INSIGHT_METRICS = ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions"] as const;
const INSTAGRAM_ACCOUNT_INSIGHT_METRICS = ["reach", "profile_views"] as const;

type ServiceRoleClient = SupabaseClient<Database>;

export interface SocialAnalyticsSyncSummary {
  workspacesConsidered: number;
  postsConsidered: number;
  postSnapshotsUpserted: number;
  accountSnapshotsUpserted: number;
  skipped: number;
  retryableFailures: number;
  terminalFailures: number;
}

export type RunSocialAnalyticsSyncBatchResult = { success: true; summary: SocialAnalyticsSyncSummary } | { success: false; reason: "service_role_unavailable" | "connections_lookup_failed" };

/** UTC, explicit — never the server's own local timezone (SOCIAL-05D Phase 9). Both snapshot_date and metric_date use this exact same logical day for one sync run. */
function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyOutcome(): WorkspaceSyncOutcome {
  return { postsConsidered: 0, postSnapshotsUpserted: 0, accountSnapshotsUpserted: 0, skipped: 0, retryableFailures: 0, terminalFailures: 0 };
}

export async function runSocialAnalyticsSyncBatch(): Promise<RunSocialAnalyticsSyncBatchResult> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    getLogger().error("Social analytics sync: service-role credential is not configured");
    return { success: false, reason: "service_role_unavailable" };
  }

  const { data: connections, error: connectionsError } = await supabase.from("integration_connections").select("id, workspace_id").eq("provider_id", "meta").eq("state", "connected");
  if (connectionsError) {
    getLogger().error("Social analytics sync: could not list connected Meta connections", { error: connectionsError.message });
    return { success: false, reason: "connections_lookup_failed" };
  }

  const summary: SocialAnalyticsSyncSummary = { workspacesConsidered: 0, postsConsidered: 0, postSnapshotsUpserted: 0, accountSnapshotsUpserted: 0, skipped: 0, retryableFailures: 0, terminalFailures: 0 };
  const snapshotDate = todayUtcDate();

  for (const connection of connections ?? []) {
    summary.workspacesConsidered += 1;
    const outcome = await syncWorkspace(supabase, connection.workspace_id, connection.id, snapshotDate);
    summary.postsConsidered += outcome.postsConsidered;
    summary.postSnapshotsUpserted += outcome.postSnapshotsUpserted;
    summary.accountSnapshotsUpserted += outcome.accountSnapshotsUpserted;
    summary.skipped += outcome.skipped;
    summary.retryableFailures += outcome.retryableFailures;
    summary.terminalFailures += outcome.terminalFailures;
  }

  return { success: true, summary };
}

interface WorkspaceSyncOutcome {
  postsConsidered: number;
  postSnapshotsUpserted: number;
  accountSnapshotsUpserted: number;
  skipped: number;
  retryableFailures: number;
  terminalFailures: number;
}

async function syncWorkspace(supabase: ServiceRoleClient, workspaceId: string, connectionId: string, snapshotDate: string): Promise<WorkspaceSyncOutcome> {
  const outcome = emptyOutcome();

  const contextResult = await resolveWorkspaceAnalyticsContext(workspaceId, connectionId);
  if (!contextResult.success) {
    // Auth/credential problem for this whole workspace (Phase 13): never
    // wipes existing snapshots, never mutates SocialPost, never marks a
    // metric as zero — this workspace's history simply gets no new point
    // this run. Existing stale data remains valid and visible.
    outcome.terminalFailures += 1;
    return outcome;
  }
  const { context } = contextResult;
  const provider = new MetaProvider(context.accessToken);

  if (context.instagramAccountId) {
    const accountOutcome = await syncAccountSnapshot(supabase, provider, workspaceId, connectionId, context.instagramAccountId, snapshotDate);
    if (accountOutcome === "upserted") outcome.accountSnapshotsUpserted += 1;
    else if (accountOutcome === "retryable") outcome.retryableFailures += 1;
    else outcome.terminalFailures += 1;
  } else {
    outcome.skipped += 1;
  }

  const { data: postRows, error: postsError } = await supabase
    .from("social_posts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .not("provider_post_id", "is", null);
  if (postsError) {
    outcome.terminalFailures += 1;
    return outcome;
  }

  for (const row of postRows ?? []) {
    const post = mapSocialPostRow(row);
    outcome.postsConsidered += 1;
    const postOutcome = await syncPostSnapshot(supabase, provider, connectionId, post, snapshotDate);
    if (postOutcome === "upserted") outcome.postSnapshotsUpserted += 1;
    else if (postOutcome === "retryable") outcome.retryableFailures += 1;
    else outcome.terminalFailures += 1;
  }

  return outcome;
}

type SyncOutcome = "upserted" | "retryable" | "terminal";

function classifyAndLogUnexpectedError(connectionId: string, error: unknown, context: string): "retryable" | "terminal" {
  if (isMetaAuthError(error)) return "terminal";
  if (isMetaRateLimitError(error)) return "retryable";
  const record = sanitizeIntegrationError({ connectionId, providerId: "meta", rawMessage: error instanceof Error ? error.message : `Unknown Meta analytics sync error (${context})` });
  insertErrorRecord(record);
  return "terminal";
}

async function syncAccountSnapshot(
  supabase: ServiceRoleClient,
  provider: MetaProvider,
  workspaceId: string,
  connectionId: string,
  instagramAccountId: string,
  metricDate: string,
): Promise<SyncOutcome> {
  try {
    const insights = await provider.getInstagramAccountInsights(instagramAccountId, [...INSTAGRAM_ACCOUNT_INSIGHT_METRICS]);
    const rawMetrics: Record<string, number> = {};
    const typed: Partial<Record<(typeof INSTAGRAM_ACCOUNT_INSIGHT_METRICS)[number], number>> = {};
    for (const entry of insights) {
      rawMetrics[entry.metric] = entry.value;
      if ((INSTAGRAM_ACCOUNT_INSIGHT_METRICS as readonly string[]).includes(entry.metric)) {
        typed[entry.metric as (typeof INSTAGRAM_ACCOUNT_INSIGHT_METRICS)[number]] = entry.value;
      }
    }

    const { error } = await supabase
      .from("social_account_metric_snapshots")
      .upsert(
        {
          workspace_id: workspaceId,
          instagram_account_id: instagramAccountId,
          metric_date: metricDate,
          reach: typed.reach ?? null,
          profile_views: typed.profile_views ?? null,
          raw_metrics: rawMetrics,
        },
        { onConflict: "workspace_id,instagram_account_id,metric_date" },
      );
    if (error) {
      getLogger().error("Social analytics sync: account snapshot upsert failed", { workspaceId, error: error.message });
      return "terminal";
    }
    return "upserted";
  } catch (error) {
    return classifyAndLogUnexpectedError(connectionId, error, "account");
  }
}

async function syncPostSnapshot(supabase: ServiceRoleClient, provider: MetaProvider, connectionId: string, post: SocialPost, snapshotDate: string): Promise<SyncOutcome> {
  // Never sync a post without a real provider_post_id — the caller (this
  // module's own social_posts query) already filters on
  // `provider_post_id is not null`, but this stays defensive rather than
  // trusting the query alone (Phase 5 — never infer a provider id).
  if (!post.provider_post_id) return "terminal";

  try {
    const insights = await provider.getInstagramMediaInsights(post.provider_post_id, [...INSTAGRAM_IMAGE_INSIGHT_METRICS]);
    const rawMetrics: Record<string, number> = {};
    const typed: Partial<Record<(typeof INSTAGRAM_IMAGE_INSIGHT_METRICS)[number], number>> = {};
    for (const entry of insights) {
      rawMetrics[entry.metric] = entry.value;
      if ((INSTAGRAM_IMAGE_INSIGHT_METRICS as readonly string[]).includes(entry.metric)) {
        typed[entry.metric as (typeof INSTAGRAM_IMAGE_INSIGHT_METRICS)[number]] = entry.value;
      }
    }

    const { error } = await supabase
      .from("social_post_metric_snapshots")
      .upsert(
        {
          workspace_id: post.workspace_id,
          social_post_id: post.id,
          provider_media_id: post.provider_post_id,
          snapshot_date: snapshotDate,
          views: typed.views ?? null,
          reach: typed.reach ?? null,
          likes: typed.likes ?? null,
          comments: typed.comments ?? null,
          shares: typed.shares ?? null,
          saved: typed.saved ?? null,
          total_interactions: typed.total_interactions ?? null,
          raw_metrics: rawMetrics,
        },
        { onConflict: "social_post_id,snapshot_date" },
      );
    if (error) {
      getLogger().error("Social analytics sync: post snapshot upsert failed", { socialPostId: post.id, error: error.message });
      return "terminal";
    }
    return "upserted";
  } catch (error) {
    // Deleted/inaccessible media (Phase 15) falls through to the generic
    // classification below exactly like any other unclassified provider
    // error — MetaProvider exposes no distinct not-found matcher today, and
    // inventing one here would be a second error taxonomy (Phase 12
    // forbids this). It is skipped (terminal, this run only) — the
    // SocialPost row and all of its prior analytics history are untouched.
    return classifyAndLogUnexpectedError(connectionId, error, "post");
  }
}
