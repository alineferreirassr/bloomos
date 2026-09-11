"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createSocialPost,
  updateSocialPostDraft,
  beginSocialPostPublish,
  setSocialPostContainerId,
  markSocialPostPublished,
  markSocialPostFailed,
  listSocialPosts,
  getSocialPost,
  getMediaAssetById,
  getMediaAssetDownloadUrl,
} from "@/lib/data";
import { getOwnProviderConnectionAction } from "@/modules/integrations/manageOAuthConnectionActions";
import { getCredential, resolveAccessToken } from "@/core/integrations/credentialManager";
import { MetaProvider, isMetaAuthError } from "@/core/integrations/providers/meta/metaProvider";
import { sanitizeIntegrationError } from "@/core/integrations/errorSanitizer";
import { insertErrorRecord } from "@/lib/data/core/integrations/errorRecordStore";
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
const RECONNECT_ERROR = "Reconnect Meta to enable publishing.";
const SUPPORTED_IMAGE_MIME_TYPE = "image/jpeg";

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

  const begun = await beginSocialPostPublish(id);
  if (!begun.success) return { success: false, error: begun.error };
  let post = begun.data;

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

  try {
    const provider = new MetaProvider(accessToken);
    const urlResult = await getMediaAssetDownloadUrl(post.asset_id, 3600);
    if (!urlResult.success) throw new Error(urlResult.error);

    let containerId = post.provider_container_id;
    if (!containerId) {
      const container = await provider.createInstagramMediaContainer(post.target_instagram_account_id, { imageUrl: urlResult.data.url, caption: post.caption });
      containerId = container.containerId;
      const withContainer = await setSocialPostContainerId(id, containerId);
      if (!withContainer.success) throw new Error(withContainer.error);
      post = withContainer.data;
    }

    const published = await provider.publishInstagramMedia(post.target_instagram_account_id, containerId);
    const permalink = await provider.getInstagramMediaPermalink(published.mediaId);

    const result = await markSocialPostPublished(id, { providerPostId: published.mediaId, providerPermalink: permalink });
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data };
  } catch (error) {
    if (isMetaAuthError(error)) {
      const failed = await markSocialPostFailed(id, RECONNECT_ERROR);
      return { success: false, error: failed.success ? RECONNECT_ERROR : failed.error };
    }
    const record = sanitizeIntegrationError({ connectionId: own.data.id, providerId: "meta", rawMessage: error instanceof Error ? error.message : "Unknown Meta publishing error" });
    insertErrorRecord(record);
    const failed = await markSocialPostFailed(id, record.message);
    return { success: false, error: failed.success ? record.message : failed.error };
  }
}
