"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createSocialPost,
  updateSocialPostDraft,
  beginSocialPostPublish,
  setSocialPostContainerId,
  markSocialPostPublished,
  markSocialPostFailed,
  scheduleSocialPost,
  rescheduleSocialPost,
  cancelSocialPostSchedule,
  listSocialPosts,
  getSocialPost,
  getMediaAssetById,
  getMediaAssetDownloadUrl,
} from "@/lib/data";
import { getOwnProviderConnectionAction } from "@/modules/integrations/manageOAuthConnectionActions";
import { getCredential, resolveAccessToken } from "@/core/integrations/credentialManager";
import { MetaProvider, isMetaAuthError, isMetaRateLimitError } from "@/core/integrations/providers/meta/metaProvider";
import { sanitizeIntegrationError } from "@/core/integrations/errorSanitizer";
import { insertErrorRecord } from "@/lib/data/core/integrations/errorRecordStore";
import { executeSocialPostPublish } from "@/core/social/socialPublishExecution";
import { RECONNECT_ERROR } from "@/core/social/socialSchedulingPolicy";
import { socialPostScheduleSchema } from "@/modules/socialPosts/schema";
import type { SocialPost } from "@/types/socialPost";
import type { IntegrationConnection } from "@/core/integrations/types";

/**
 * SOCIAL-03 — the one place this checkpoint's Instagram publishing
 * actually happens. Deliberately its own file (not merged into
 * `metaAccountActions.ts`, which stays SOCIAL-02's own account/discovery
 * concern) — this file owns the Social Post *business lifecycle*
 * (draft/publishing/published/failed), `MetaProvider` owns the raw Graph
 * API mechanics, matching this codebase's established "domain/service
 * handles lifecycle, provider handles API mechanics" split exactly
 * (mirrors `sendContractForSignatureAction`/`DocuSignProvider`).
 */

const GENERIC_ACCESS_ERROR = "That isn't available. You may not have access to it.";
const NOT_FOUND_ERROR = "This social post could not be found.";
const RECONNECT_ANALYTICS_ERROR = "Reconnect Meta to enable Instagram analytics.";
const NOT_ELIGIBLE_FOR_INSIGHTS_ERROR = "Insights are only available for a post BloomOS has published to Instagram.";
const RATE_LIMITED_ERROR = "Instagram is rate-limiting requests right now. Try again in a few minutes.";
const SUPPORTED_IMAGE_MIME_TYPE = "image/jpeg";

/**
 * SOCIAL-05B — the exact, live-verified (Meta's own `ig-media/insights`
 * reference) image-post metric set. Deliberately excludes `impressions`
 * (deprecated for every image published after 2024-07-02, i.e. every post
 * BloomOS will ever publish) and every Reel/video/carousel/Story-only
 * metric, since none of those media types are publishable through
 * BloomOS yet either.
 */
const INSTAGRAM_IMAGE_INSIGHT_METRICS = ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions"] as const;
type InstagramImageInsightMetric = (typeof INSTAGRAM_IMAGE_INSIGHT_METRICS)[number];

/**
 * A metric present in `metrics` is a real value Meta returned for this
 * post — including a real `0`. A metric absent from `metrics` (even one
 * that was requested) means Meta did not return a value for it right now
 * (commonly: published too recently — Meta's own data can be delayed up
 * to 48 hours) and must be rendered as "unavailable," never coerced to 0.
 */
export interface SocialPostInsights {
  metrics: Partial<Record<InstagramImageInsightMetric, number>>;
}

type Result<T> = { success: true; data: T } | { success: false; error: string };

type ActiveSessionResult =
  | { success: false; error: string }
  | { success: true; session: Awaited<ReturnType<typeof resolveMemberSessionSnapshot>> & { kind: "active" } };

async function requireActiveSession(permission: "social.view" | "social.create" | "social.publish"): Promise<ActiveSessionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes(permission)) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, session };
}

async function loadOwnedPost(id: string, workspaceId: string): Promise<SocialPost | null> {
  const post = await getSocialPost(id).catch(() => null);
  if (!post || post.workspace_id !== workspaceId) return null;
  return post;
}

/**
 * Re-derives and validates everything a create/publish call needs from the
 * caller's own workspace — never trusts a caller-supplied connection/Page/
 * Instagram identity. Requires a `connected` Meta connection with an
 * actual selected publishing identity (`meta_page_id`/
 * `meta_instagram_account_id` in the connection's own `config`, set by
 * SOCIAL-02's `selectMetaPublishingIdentityAction`) — never fabricates one
 * from a bare successful OAuth connection.
 */
type SelectedMetaIdentityResult =
  | { success: false; error: string }
  | { success: true; connection: IntegrationConnection; pageId: string; instagramAccountId: string };

async function requireSelectedMetaIdentity(): Promise<SelectedMetaIdentityResult> {
  const own = await getOwnProviderConnectionAction("meta");
  if (!own.success || !own.data || own.data.state !== "connected") return { success: false, error: "Connect Meta and select a publishing Page first." };

  const pageId = typeof own.data.config.meta_page_id === "string" ? own.data.config.meta_page_id : null;
  const instagramAccountId = typeof own.data.config.meta_instagram_account_id === "string" ? own.data.config.meta_instagram_account_id : null;
  if (!pageId || !instagramAccountId) return { success: false, error: "Select a Meta Page with a linked Instagram account first." };

  return { success: true, connection: own.data, pageId, instagramAccountId };
}

type AssetValidationResult = { success: true } | { success: false; error: string };

async function validateOwnedApprovedImageAsset(assetId: string, workspaceId: string): Promise<AssetValidationResult> {
  const asset = await getMediaAssetById(assetId).catch(() => null);
  if (!asset || asset.workspace_id !== workspaceId) return { success: false, error: "That image could not be found." };
  if (asset.mime_type !== SUPPORTED_IMAGE_MIME_TYPE) return { success: false, error: "Instagram requires a JPEG image." };
  if (asset.status !== "approved") return { success: false, error: "Only an approved image can be published." };
  return { success: true };
}

export async function listSocialPostsAction(): Promise<Result<SocialPost[]>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;
  return { success: true, data: await listSocialPosts(resolved.session.workspace.id) };
}

export async function getSocialPostAction(id: string): Promise<Result<SocialPost>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;
  const post = await loadOwnedPost(id, resolved.session.workspace.id);
  if (!post) return { success: false, error: NOT_FOUND_ERROR };
  return { success: true, data: post };
}

export async function createSocialPostAction(input: { caption: string; assetId: string }): Promise<Result<SocialPost>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const identity = await requireSelectedMetaIdentity();
  if (!identity.success) return identity;

  const assetCheck = await validateOwnedApprovedImageAsset(input.assetId, resolved.session.workspace.id);
  if (!assetCheck.success) return assetCheck;

  return createSocialPost({
    workspaceId: resolved.session.workspace.id,
    createdBy: resolved.session.user.id,
    caption: input.caption,
    assetId: input.assetId,
    connectionId: identity.connection.id,
    pageId: identity.pageId,
    instagramAccountId: identity.instagramAccountId,
  });
}

export async function updateSocialPostDraftAction(id: string, input: { caption?: string; assetId?: string }): Promise<Result<SocialPost>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedPost(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: NOT_FOUND_ERROR };

  if (input.assetId) {
    const assetCheck = await validateOwnedApprovedImageAsset(input.assetId, resolved.session.workspace.id);
    if (!assetCheck.success) return assetCheck;
  }

  return updateSocialPostDraft(id, input);
}

/**
 * Publish Now — the exact 16-step sequence SOCIAL03-T calls for, condensed
 * to what actually matters mechanically:
 *
 * 1-4. authenticate, require `social.publish`, load the post from the
 *      caller's own workspace, atomically transition it to `publishing`
 *      (the real idempotency guard — a losing concurrent call fails here,
 *      before any provider call is ever made).
 * 5-7. re-derive the connection/credential/scopes from the workspace's own
 *      Meta connection — never from the post's own stale
 *      target_connection_id blindly (re-verified against the current
 *      connection's own state and scopes every time).
 * 8-9. validate the asset again (it may have been unapproved/archived
 *      since the draft was created) and resolve a fresh, short-lived
 *      signed URL via the existing Assets download-URL mechanism — never
 *      a permanently public bucket.
 * 10-12. create (or reuse an already-created) container, then publish it —
 *      image-only, synchronous, no polling.
 * 13-16. persist the real result and return a sanitized outcome. The
 *      access token itself is never included in any return value.
 */
export async function publishSocialPostNowAction(id: string): Promise<Result<SocialPost>> {
  const resolved = await requireActiveSession("social.publish");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedPost(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: NOT_FOUND_ERROR };

  // The real idempotency guard, and (SOCIAL-04B) the manual-vs-scheduler
  // race resolver: this same atomic status transition is exactly what
  // `claim_due_social_posts()` also competes on — whichever commits first
  // wins, the other gets this exact deterministic `fail()`.
  const begun = await beginSocialPostPublish(id);
  if (!begun.success) return { success: false, error: begun.error };
  const post = begun.data;

  const own = await getOwnProviderConnectionAction("meta");
  if (!own.success || !own.data || own.data.id !== post.target_connection_id || own.data.state !== "connected" || !own.data.credential_id) {
    const failed = await markSocialPostFailed(id, RECONNECT_ERROR);
    return { success: false, error: failed.success ? RECONNECT_ERROR : failed.error };
  }

  const credential = await getCredential(own.data.credential_id);
  if (!credential || !credential.scopes.includes("instagram_content_publish")) {
    const failed = await markSocialPostFailed(id, RECONNECT_ERROR);
    return { success: false, error: failed.success ? RECONNECT_ERROR : failed.error };
  }

  const accessToken = await resolveAccessToken(own.data.credential_id);
  if (!accessToken) {
    const failed = await markSocialPostFailed(id, RECONNECT_ERROR);
    return { success: false, error: failed.success ? RECONNECT_ERROR : failed.error };
  }

  const assetCheck = await validateOwnedApprovedImageAsset(post.asset_id, resolved.session.workspace.id);
  if (!assetCheck.success) {
    await markSocialPostFailed(id, assetCheck.error);
    return assetCheck;
  }

  const urlResult = await getMediaAssetDownloadUrl(post.asset_id, 3600);
  if (!urlResult.success) {
    await markSocialPostFailed(id, urlResult.error);
    return urlResult;
  }

  // SOCIAL-04B — the actual Meta publication mechanics (container
  // create-or-refuse-to-reuse, publish, permalink, persist) are shared with
  // the background scheduler via `executeSocialPostPublish` (SOCIAL-04A
  // Phase 17) — this interactive path just ignores the retry/backoff half
  // of its failure classification (no scheduling concept here).
  const result = await executeSocialPostPublish({
    post,
    accessToken,
    imageUrl: urlResult.data.url,
    persistence: {
      setContainerId: (containerId) => setSocialPostContainerId(id, containerId),
      markPublished: (published) => markSocialPostPublished(id, published),
      markFailed: ({ message }) => markSocialPostFailed(id, message),
    },
  });

  if (!result.success) return { success: false, error: result.failure.message };
  return { success: true, data: result.post };
}

/**
 * SOCIAL-04B — `draft`/`failed` -> `scheduled`. Legal from `failed` too
 * (explicitly supports rescheduling a post whose earlier publish attempt
 * failed, rather than leaving that only reachable via a fresh draft).
 * Never generates or stores a signed asset URL — that's resolved fresh,
 * by the scheduler itself, at execution time (SOCIAL-04A Phase 11).
 */
export async function scheduleSocialPostAction(id: string, input: { scheduledAt: string; scheduledTimezone: string | null }): Promise<Result<SocialPost>> {
  const resolved = await requireActiveSession("social.publish");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedPost(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: NOT_FOUND_ERROR };

  const parsed = socialPostScheduleSchema.safeParse({ scheduled_at: input.scheduledAt, scheduled_timezone: input.scheduledTimezone });
  if (!parsed.success) return { success: false, error: "Please fix the highlighted fields." };

  const assetCheck = await validateOwnedApprovedImageAsset(existing.asset_id, resolved.session.workspace.id);
  if (!assetCheck.success) return assetCheck;

  return scheduleSocialPost(id, { scheduledAt: parsed.data.scheduled_at, scheduledTimezone: parsed.data.scheduled_timezone ?? null });
}

/** SOCIAL-04B — `scheduled` -> `scheduled` only; rejects (atomically) once a worker or manual Publish Now has already claimed the post. */
export async function rescheduleSocialPostAction(id: string, input: { scheduledAt: string; scheduledTimezone: string | null }): Promise<Result<SocialPost>> {
  const resolved = await requireActiveSession("social.publish");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedPost(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: NOT_FOUND_ERROR };

  const parsed = socialPostScheduleSchema.safeParse({ scheduled_at: input.scheduledAt, scheduled_timezone: input.scheduledTimezone });
  if (!parsed.success) return { success: false, error: "Please fix the highlighted fields." };

  return rescheduleSocialPost(id, { scheduledAt: parsed.data.scheduled_at, scheduledTimezone: parsed.data.scheduled_timezone ?? null });
}

/** SOCIAL-04B — `scheduled` -> `draft`, atomically. Never touches caption/asset/destination. Rejects (atomically) once claimed. */
export async function cancelSocialPostScheduleAction(id: string): Promise<Result<SocialPost>> {
  const resolved = await requireActiveSession("social.publish");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedPost(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: NOT_FOUND_ERROR };

  return cancelSocialPostSchedule(id);
}

/**
 * SOCIAL-05B — on-demand Instagram image-post analytics. Deliberately the
 * mirror of `publishSocialPostNowAction`'s own auth/connection/scope/
 * token-resolution shape (`social.view` instead of `social.publish`, no
 * idempotency guard needed since this never mutates the post) — never a
 * second, divergent way of reaching Meta. No persistence: every call
 * re-fetches from Meta directly; no scheduler, no service-role, no new
 * table (see SOCIAL-05A's own architecture-gate report for why none of
 * those are needed for this MVP).
 *
 * `provider_post_id` is always read from the caller's own workspace-owned
 * `SocialPost` row — a caller can only ever request insights for *this
 * post's own id*, never supply a Graph media id directly, so there is no
 * way to probe an arbitrary Instagram media id through this action.
 */
export async function getSocialPostInsightsAction(id: string): Promise<Result<SocialPostInsights>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;

  const post = await loadOwnedPost(id, resolved.session.workspace.id);
  if (!post) return { success: false, error: NOT_FOUND_ERROR };

  if (post.status !== "published" || !post.provider_post_id) {
    return { success: false, error: NOT_ELIGIBLE_FOR_INSIGHTS_ERROR };
  }

  const own = await getOwnProviderConnectionAction("meta");
  if (!own.success || !own.data || own.data.id !== post.target_connection_id || own.data.state !== "connected" || !own.data.credential_id) {
    return { success: false, error: RECONNECT_ANALYTICS_ERROR };
  }

  const credential = await getCredential(own.data.credential_id);
  if (!credential || !credential.scopes.includes("instagram_manage_insights")) {
    return { success: false, error: RECONNECT_ANALYTICS_ERROR };
  }

  const accessToken = await resolveAccessToken(own.data.credential_id);
  if (!accessToken) return { success: false, error: RECONNECT_ANALYTICS_ERROR };

  try {
    const provider = new MetaProvider(accessToken);
    const insights = await provider.getInstagramMediaInsights(post.provider_post_id, [...INSTAGRAM_IMAGE_INSIGHT_METRICS]);

    const metrics: SocialPostInsights["metrics"] = {};
    for (const entry of insights) {
      if ((INSTAGRAM_IMAGE_INSIGHT_METRICS as readonly string[]).includes(entry.metric)) {
        metrics[entry.metric as InstagramImageInsightMetric] = entry.value;
      }
    }
    return { success: true, data: { metrics } };
  } catch (error) {
    if (isMetaAuthError(error)) return { success: false, error: RECONNECT_ANALYTICS_ERROR };
    if (isMetaRateLimitError(error)) return { success: false, error: RATE_LIMITED_ERROR };
    const record = sanitizeIntegrationError({ connectionId: own.data.id, providerId: "meta", rawMessage: error instanceof Error ? error.message : "Unknown Meta insights error" });
    insertErrorRecord(record);
    return { success: false, error: record.message };
  }
}
