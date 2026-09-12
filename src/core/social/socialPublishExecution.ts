import { MetaProvider } from "@/core/integrations/providers/meta/metaProvider";
import { sanitizeIntegrationError } from "@/core/integrations/errorSanitizer";
import { RECONNECT_ERROR } from "@/core/social/socialSchedulingPolicy";
import type { SocialPost } from "@/types/socialPost";
import type { DataResult } from "@/lib/data/result";

/**
 * SOCIAL-04B — the one place Instagram image publication mechanics
 * actually happen, shared by both the interactive `publishSocialPostNowAction`
 * and the background scheduler (`scheduledPostExecutor.ts`), per SOCIAL-04A's
 * own Phase 17 requirement. Everything session/workspace/claim-specific
 * (authenticating the caller, claiming the post, resolving the connection/
 * credential/asset, generating the fresh signed image URL) stays with each
 * caller — this function only ever receives an already-claimed post, a
 * resolved access token, and a resolved fresh image URL. `persistence` is
 * injected because the two callers persist through different Supabase
 * clients (the ordinary session-bound repository for the interactive path,
 * a service-role client for the background path) — the mechanics here are
 * identical either way.
 */

export interface SocialPublishPersistence {
  setContainerId(containerId: string): Promise<DataResult<SocialPost>>;
  markPublished(result: { providerPostId: string; providerPermalink: string | null }): Promise<DataResult<SocialPost>>;
  /**
   * `retryable` carries this function's own classification so each caller's
   * closure can decide what it means for that caller: the interactive path
   * (no backoff concept) simply ignores it and always persists a terminal
   * failure; the background executor (`scheduledPostExecutor.ts`) uses it,
   * together with the post's own already-incremented `publish_attempts`, to
   * compute `next_attempt_at` (a future instant) or leave it `null`
   * (terminal — non-retryable, or attempts exhausted).
   */
  markFailed(params: { message: string; retryable: boolean }): Promise<DataResult<SocialPost>>;
}

export interface ExecuteSocialPostPublishParams {
  post: SocialPost;
  accessToken: string;
  imageUrl: string;
  persistence: SocialPublishPersistence;
}

export interface SocialPublishFailure {
  /** `sanitizeIntegrationError`'s own classification — reused verbatim so both callers apply the exact same retryable/terminal taxonomy every other retrying subsystem in this codebase uses. `"unsafe_retry"` is SOCIAL-04B's own addition (see below), always non-retryable. */
  category: ReturnType<typeof sanitizeIntegrationError>["category"] | "unsafe_retry";
  retryable: boolean;
  message: string;
  isAuthError: boolean;
}

export type SocialPublishExecutionResult = { success: true; post: SocialPost } | { success: false; post: SocialPost | null; failure: SocialPublishFailure };

const META_STATUS_PATTERN = /Meta Graph API error (\d+):/;

function extractMetaStatusCode(message: string): number | undefined {
  const match = META_STATUS_PATTERN.exec(message);
  return match ? Number(match[1]) : undefined;
}

function isMetaAuthErrorMessage(message: string): boolean {
  return /\b190\b|access token/i.test(message);
}

/**
 * SOCIAL-04A Phase 18's proven gap, closed the only way the current
 * `MetaProvider` abstraction can safely close it: that class has no method
 * to query whether a Graph API media container was already published (no
 * `GET /{container-id}?fields=status_code` call exists in this codebase —
 * confirmed by direct audit, not assumed), so this function can never prove
 * "the previous attempt's `media_publish` call didn't actually reach Meta."
 * A `post.provider_container_id` already set when this function is called
 * therefore means a *prior* attempt got at least as far as creating a
 * container — retrying `publishInstagramMedia` blindly risks a duplicate
 * live Instagram publication, which this function refuses to risk. It
 * fails this case terminally (`category: "unsafe_retry"`, never retryable)
 * for manual reconciliation, rather than inventing a Meta API guarantee
 * this codebase doesn't implement. A container created *during this same
 * call* (the `!containerId` branch below) is always safe to publish
 * immediately after — nothing about it could have been attempted twice.
 */
export async function executeSocialPostPublish(params: ExecuteSocialPostPublishParams): Promise<SocialPublishExecutionResult> {
  const { post, accessToken, imageUrl, persistence } = params;

  if (post.provider_container_id) {
    const message = "This post may already be publishing or published on Instagram — manual review is required before retrying, to avoid a duplicate publication.";
    const failed = await persistence.markFailed({ message, retryable: false });
    return { success: false, post: failed.success ? failed.data : null, failure: { category: "unsafe_retry", retryable: false, message, isAuthError: false } };
  }

  try {
    const provider = new MetaProvider(accessToken);

    const container = await provider.createInstagramMediaContainer(post.target_instagram_account_id, { imageUrl, caption: post.caption });
    const withContainer = await persistence.setContainerId(container.containerId);
    if (!withContainer.success) throw new Error(withContainer.error);

    const published = await provider.publishInstagramMedia(post.target_instagram_account_id, container.containerId);
    const permalink = await provider.getInstagramMediaPermalink(published.mediaId);

    const result = await persistence.markPublished({ providerPostId: published.mediaId, providerPermalink: permalink });
    if (!result.success) {
      return { success: false, post: null, failure: { category: "unknown", retryable: false, message: result.error, isAuthError: false } };
    }
    return { success: true, post: result.data };
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Unknown Meta publishing error";
    const isAuthError = isMetaAuthErrorMessage(rawMessage);
    const record = sanitizeIntegrationError({ connectionId: post.target_connection_id, providerId: "meta", rawMessage, statusCode: extractMetaStatusCode(rawMessage) });
    // An auth failure always surfaces/persists the same friendly
    // RECONNECT_ERROR string — never the raw sanitized classification —
    // matching `publishSocialPostNowAction`'s own pre-existing behavior for
    // every other Meta connection/credential problem it already reports
    // this way.
    const message = isAuthError ? RECONNECT_ERROR : record.message;
    const retryable = isAuthError ? false : record.retryable;
    const failed = await persistence.markFailed({ message, retryable });
    return {
      success: false,
      post: failed.success ? failed.data : null,
      failure: { category: isAuthError ? "auth" : record.category, retryable, message, isAuthError },
    };
  }
}
