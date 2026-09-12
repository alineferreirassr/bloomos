import "server-only";
import { getLogger } from "@/core/observability/logger";
import { createServiceRoleClient, resolveSocialSchedulerContext } from "@/core/social/socialSchedulerServiceRole";
import { executeSocialPostPublish, type SocialPublishPersistence } from "@/core/social/socialPublishExecution";
import { MAX_PUBLISH_ATTEMPTS, SOCIAL_RETRY_POLICY, getClaimLeaseMs } from "@/core/social/socialSchedulingPolicy";
import { computeBackoffDelayMs } from "@/core/integrations/retryEngine";
import { mapSocialPostRow } from "@/lib/supabase/mappers";
import { type DataResult, ok, fail } from "@/lib/data/result";
import type { SocialPost } from "@/types/socialPost";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SOCIAL-04B — the background scheduler's own orchestration, invoked only
 * from the CRON_SECRET-protected route (`app/api/social/scheduler/route.ts`).
 * Owns exactly three things the interactive path doesn't need: the
 * lease-recovery sweep, the atomic multi-row claim, and the retry/backoff
 * decision after a failure — everything else (the actual Meta publication
 * mechanics) is the same `executeSocialPostPublish` the interactive
 * `publishSocialPostNowAction` uses (SOCIAL-04A Phase 17).
 *
 * Never reuses `SocialPostsRepository` (every implementation calls
 * `requireWorkspaceSession()`, which this caller — no browser session —
 * can never satisfy, SOCIAL-04A Phase 8) — all persistence here goes
 * through the same service-role client the claim RPC itself uses.
 */

const DEFAULT_BATCH_LIMIT = 10;

export interface ScheduledPostBatchSummary {
  reclaimed: number;
  claimed: number;
  published: number;
  failedRetryable: number;
  failedTerminal: number;
}

export type RunScheduledSocialPostBatchResult = { success: true; summary: ScheduledPostBatchSummary } | { success: false; reason: "service_role_unavailable" | "claim_failed" | "reclaim_failed" };

export async function runScheduledSocialPostBatch(limit: number = DEFAULT_BATCH_LIMIT): Promise<RunScheduledSocialPostBatchResult> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    getLogger().error("Social scheduler: service-role credential is not configured");
    return { success: false, reason: "service_role_unavailable" };
  }

  const { data: reclaimedCount, error: reclaimError } = await supabase.rpc("reclaim_abandoned_social_posts", { p_lease_seconds: Math.round(getClaimLeaseMs() / 1000) });
  if (reclaimError) {
    getLogger().error("Social scheduler: reclaim_abandoned_social_posts RPC failed", { error: reclaimError.message });
    return { success: false, reason: "reclaim_failed" };
  }

  const { data: claimedRows, error: claimError } = await supabase.rpc("claim_due_social_posts", { p_limit: limit });
  if (claimError) {
    getLogger().error("Social scheduler: claim_due_social_posts RPC failed", { error: claimError.message });
    return { success: false, reason: "claim_failed" };
  }

  const claimedPosts = (claimedRows ?? []).map(mapSocialPostRow);
  const summary: ScheduledPostBatchSummary = { reclaimed: reclaimedCount ?? 0, claimed: claimedPosts.length, published: 0, failedRetryable: 0, failedTerminal: 0 };

  for (const post of claimedPosts) {
    const outcome = await executeClaimedPost(supabase, post);
    if (outcome === "published") summary.published += 1;
    else if (outcome === "retryable") summary.failedRetryable += 1;
    else summary.failedTerminal += 1;
  }

  return { success: true, summary };
}

type ServiceRoleClient = SupabaseClient<Database>;
type SocialPostUpdate = Database["public"]["Tables"]["social_posts"]["Update"];

async function updateSocialPostServiceRole(supabase: ServiceRoleClient, id: string, patch: SocialPostUpdate): Promise<DataResult<SocialPost>> {
  const { data, error } = await supabase.from("social_posts").update(patch).eq("id", id).select("*").maybeSingle();
  if (error || !data) return fail("Could not update the social post.");
  return ok(mapSocialPostRow(data));
}

/**
 * The scheduler's own `markFailed` — the one place `publish_attempts`
 * (already incremented by `claim_due_social_posts`) and `MAX_PUBLISH_ATTEMPTS`
 * decide whether this failure gets a future `next_attempt_at` (retryable,
 * attempts remaining) or is terminal (`next_attempt_at` null — either
 * non-retryable, or the attempt ceiling `claim_due_social_posts()` itself
 * also enforces is reached). Reuses `computeBackoffDelayMs` — the exact
 * shared backoff primitive every other retrying subsystem in this codebase
 * uses, no new formula (SOCIAL-04A Phase 9).
 */
async function markScheduledPostFailed(supabase: ServiceRoleClient, post: SocialPost, message: string, retryable: boolean): Promise<DataResult<SocialPost>> {
  const eligibleForRetry = retryable && post.publish_attempts < MAX_PUBLISH_ATTEMPTS;
  const nextAttemptAt = eligibleForRetry ? new Date(Date.now() + computeBackoffDelayMs(post.publish_attempts, SOCIAL_RETRY_POLICY)).toISOString() : null;
  return updateSocialPostServiceRole(supabase, post.id, { status: "failed", provider_error: message, next_attempt_at: nextAttemptAt });
}

async function executeClaimedPost(supabase: ServiceRoleClient, post: SocialPost): Promise<"published" | "retryable" | "terminal"> {
  const context = await resolveSocialSchedulerContext(post);
  if (!context.success) {
    // Connection/credential/asset problems are always terminal (SOCIAL-04A
    // Phase 12/16) — no amount of waiting fixes a disconnected Meta
    // account or a rejected asset on its own; a human must act.
    await markScheduledPostFailed(supabase, post, context.failure.message, false);
    return "terminal";
  }

  const persistence: SocialPublishPersistence = {
    setContainerId: (containerId) => updateSocialPostServiceRole(supabase, post.id, { provider_container_id: containerId }),
    markPublished: (result) =>
      updateSocialPostServiceRole(supabase, post.id, {
        status: "published",
        provider_post_id: result.providerPostId,
        provider_permalink: result.providerPermalink,
        provider_error: null,
        published_at: new Date().toISOString(),
      }),
    markFailed: ({ message, retryable }) => markScheduledPostFailed(supabase, post, message, retryable),
  };

  const result = await executeSocialPostPublish({ post, accessToken: context.accessToken, imageUrl: context.imageUrl, persistence });
  if (result.success) return "published";
  // `result.failure.retryable` is the raw error-category classification —
  // NOT the same thing as whether a retry was actually scheduled.
  // `markScheduledPostFailed` (via `persistence.markFailed` above) already
  // applied the attempt-limit ceiling and persisted the real outcome; the
  // summary must reflect that final, persisted `next_attempt_at`, not the
  // category alone, or an exhausted-but-retryable-category failure would
  // be miscounted as "retryable" even though no future attempt was scheduled.
  return result.post?.next_attempt_at ? "retryable" : "terminal";
}
