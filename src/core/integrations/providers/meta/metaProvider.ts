import type { BaseProvider } from "@/core/integrations/sdk";
import type { ProviderCapability } from "@/core/integrations/types";

/**
 * SOCIAL-02/03/05B — a real Meta Graph API adapter (Facebook Login for
 * Business flow). SOCIAL-02 added account/Page/Instagram discovery;
 * SOCIAL-03 added real Instagram image publishing — video is deliberately
 * not implemented (Meta's own video container API requires
 * asynchronous FINISHED-status polling, "once per minute, for no more
 * than 5 minutes," which is not a safe fit for a single synchronous
 * user-triggered publish request — see SOCIAL-03's own architecture-gate
 * report). SOCIAL-05B adds on-demand IMAGE post insights only — no
 * account-level insights, no Reel/video/carousel/Story metrics (none of
 * those media types are publishable through BloomOS yet either). No
 * Facebook Page publishing, no carousel, no Stories/Reels.
 *
 * SOCIAL-12B adds exactly two outbound methods — `replyToInstagramComment`
 * and `sendInstagramDirectMessage` — pure provider-layer capability only.
 * Neither is wired to the Automation Engine, a registered Action, the
 * Workflow Builder, or any UI; SOCIAL-12A's own audit confirmed this
 * capability did not exist in any form before this checkpoint (comment/DM
 * data only ever flowed inbound, via the Meta webhook). Both endpoints were
 * live-verified against developers.facebook.com on 2026-09-14 (not assumed
 * from training data — see the SOCIAL-12B report). A pull/read capability
 * (fetching a comment or conversation from Meta) was deliberately not
 * added: both new methods operate directly on the external id already
 * persisted by SOCIAL-11D's own webhook-ingestion pipeline
 * (`instagram_comments.external_comment_id`,
 * `instagram_conversations.external_participant_id`), so no lookup call is
 * needed first — see each method's own doc comment.
 *
 * Graph API version is pinned to `v26.0`, the current latest stable
 * release (2026-07-29) as of this checkpoint, verified against Meta's own
 * live developer documentation rather than assumed from training data —
 * see the SOCIAL-02/03 architecture-gate reports for the full evidence
 * trail. SOCIAL-12B re-confirmed both new endpoints are version-generic
 * (Meta's own docs pages show no version-specific gating for either), so
 * no version bump was required to add them. Bump this constant (and
 * re-verify against developers.facebook.com) the next time this provider
 * is touched for an unrelated reason, mirroring how every other
 * date-versioned provider in this codebase is expected to be re-checked
 * rather than left to silently rot on a deprecated version.
 */
const GRAPH_API_VERSION = "v26.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface MetaPageSummary {
  id: string;
  name: string;
  /** Null when this Page has no linked Instagram professional account — a successful Meta OAuth connection does not imply usable Instagram publishing capability (see SOCIAL02-V). */
  instagramAccountId: string | null;
  instagramUsername: string | null;
}

interface GraphMeResponse {
  id: string;
  name?: string;
}

interface GraphPagesResponse {
  data: Array<{
    id: string;
    name: string;
    instagram_business_account?: { id: string; username?: string };
  }>;
  paging?: { next?: string };
}

interface GraphInsightsResponse {
  data?: Array<{
    name: string;
    total_value?: { value: number };
    values?: Array<{ value: number }>;
  }>;
}

/** One Instagram image-post insight metric this provider currently requests — see `getInstagramMediaInsights`'s own doc comment for why this exact set. */
export interface InstagramMediaInsight {
  metric: string;
  value: number;
}

/** SOCIAL-12B — `replyToInstagramComment`'s own result shape, matching Meta's own `{ "id": "<reply_comment_id>" }` response verbatim. */
export interface InstagramCommentReplyResult {
  replyId: string;
}

/** SOCIAL-12B — `sendInstagramDirectMessage`'s own result shape, matching Meta's own `{ "recipient_id": "...", "message_id": "..." }` response verbatim. */
export interface InstagramDirectMessageResult {
  recipientId: string;
  messageId: string;
}

/**
 * True for Meta's own expired/invalidated-token shape (error code `190`,
 * or a message literally about an access token) — used to report a
 * truthful "reconnect required" state rather than a generic error.
 *
 * Deliberately does NOT match on the bare `OAuthException` type label:
 * SOCIAL-05B's live-doc research (`developers.facebook.com/docs/graph-api/
 * guides/error-handling`) found Meta reuses `"type":"OAuthException"` as a
 * generic wrapper across unrelated error categories — its own documented
 * rate-limit sample response (`(#32) Page request limit reached`) carries
 * that same type. Matching on the bare type alone would have misclassified
 * a rate-limited call as a reconnect-required one; `code 190`/"access
 * token" are what's actually specific to a real token failure.
 */
export function isMetaAuthError(error: unknown): boolean {
  return error instanceof Error && /\b190\b|access token/i.test(error.message);
}

/**
 * True for Meta's own documented throttling error codes (live-verified
 * against `developers.facebook.com/docs/graph-api/overview/rate-limiting`
 * and `.../guides/error-handling` for SOCIAL-05B: platform codes `4`
 * "Application request limit reached", `17`/`32` "User/Page request limit
 * reached", `341` "Application limit reached", and the Instagram-specific
 * Business Use Case limit `80002`). Matches the same way `isMetaAuthError`
 * does — against the raw Graph API JSON error body Meta returns, which
 * `request()` already embeds verbatim (truncated to 200 chars) in the
 * thrown error's message, so no separate error-class/status-code plumbing
 * is needed to detect this.
 */
export function isMetaRateLimitError(error: unknown): boolean {
  return error instanceof Error && /"code"\s*:\s*(4|17|32|341|80002)\b/.test(error.message);
}

export class MetaProvider implements BaseProvider {
  readonly providerId = "meta";
  readonly capabilities: ProviderCapability[] = ["oauth"];

  constructor(private readonly accessToken: string) {}

  /** Graph API's own well-established convention: every parameter (including a POST call's own payload) travels as a query-string param, never a JSON/form body — this matches the documented shape for every Graph API POST call, container creation and media_publish included. */
  private async request<T>(path: string, params: Record<string, string> = {}, method: "GET" | "POST" = "GET"): Promise<T> {
    const url = new URL(`${GRAPH_API_BASE}${path}`);
    url.searchParams.set("access_token", this.accessToken);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const response = await fetch(url, { method });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Meta Graph API error ${response.status}: ${body.slice(0, 200)}`);
    }
    return (await response.json()) as T;
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const startedAt = Date.now();
    try {
      await this.request<GraphMeResponse>("/me", { fields: "id,name" });
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * `GET /me/accounts` — every Facebook Page the connected user has a role
   * on, with each Page's own linked Instagram professional account (if
   * any) resolved in the same call via Graph API field expansion. Only
   * the first page of results is fetched — pagination (`paging.next`) is
   * not implemented, a known, deliberate limitation for a single-business
   * workspace with few Pages; revisit if a workspace's Page count ever
   * makes this matter.
   */
  async listPages(): Promise<MetaPageSummary[]> {
    const result = await this.request<GraphPagesResponse>("/me/accounts", { fields: "id,name,instagram_business_account{id,username}" });
    return result.data.map((page) => ({
      id: page.id,
      name: page.name,
      instagramAccountId: page.instagram_business_account?.id ?? null,
      instagramUsername: page.instagram_business_account?.username ?? null,
    }));
  }

  /**
   * `POST /{ig-user-id}/media` — creates a real Graph API media container
   * for a single JPEG image (the only image format Instagram's Content
   * Publishing API supports). Synchronous — unlike a video container, an
   * image container needs no processing wait before it can be published.
   * `imageUrl` must be a real, publicly-fetchable URL at the moment of
   * this call (the signed, time-limited Asset URL the caller resolves via
   * the existing `getMediaAssetDownloadUrl`) — Meta's own servers fetch it
   * directly, this class never uploads bytes itself.
   */
  async createInstagramMediaContainer(igUserId: string, params: { imageUrl: string; caption: string }): Promise<{ containerId: string }> {
    const result = await this.request<{ id: string }>(`/${igUserId}/media`, { image_url: params.imageUrl, caption: params.caption }, "POST");
    return { containerId: result.id };
  }

  /** `POST /{ig-user-id}/media_publish` — publishes an already-created container. Real, immediate, no polling — matches the documented image path exactly (video's own `FINISHED`-status polling requirement is deliberately never implemented here; see SOCIAL-03's own "image only, video deferred" scope decision). */
  async publishInstagramMedia(igUserId: string, containerId: string): Promise<{ mediaId: string }> {
    const result = await this.request<{ id: string }>(`/${igUserId}/media_publish`, { creation_id: containerId }, "POST");
    return { mediaId: result.id };
  }

  /** `GET /{ig-media-id}?fields=permalink` — best-effort only: a failure here never means the publish itself failed (`publishInstagramMedia` already succeeded by the time this is called), so this returns `null` on any error rather than throwing, and the caller must never fabricate a URL from a bare id if this returns null. */
  async getInstagramMediaPermalink(mediaId: string): Promise<string | null> {
    try {
      const result = await this.request<{ permalink?: string }>(`/${mediaId}`, { fields: "permalink" });
      return result.permalink ?? null;
    } catch {
      return null;
    }
  }

  /**
   * `GET /{ig-media-id}/insights` — SOCIAL-05B, on-demand only, image posts
   * only. `metrics` should be a subset of the caller's own approved,
   * live-verified IMAGE-post metric list (`views`, `reach`, `likes`,
   * `comments`, `shares`, `saved`, `total_interactions` —
   * `INSTAGRAM_IMAGE_INSIGHT_METRICS` in `socialPostActions.ts`); this
   * method itself stays metric-list-agnostic rather than hardcoding that
   * set twice.
   *
   * Critically, this NEVER invents a `0` for a metric Meta didn't actually
   * return a numeric value for — only entries where Meta itself supplied a
   * real `total_value`/`values[].value` number are included in the
   * result. A metric absent from the response (delayed availability,
   * unsupported for this media, or omitted for any other provider reason)
   * is simply absent from the returned array; the caller must treat that
   * as "unavailable," never as a real zero.
   */
  async getInstagramMediaInsights(mediaId: string, metrics: string[]): Promise<InstagramMediaInsight[]> {
    const result = await this.request<GraphInsightsResponse>(`/${mediaId}/insights`, { metric: metrics.join(",") });
    const insights: InstagramMediaInsight[] = [];
    for (const entry of result.data ?? []) {
      const value = entry.total_value?.value ?? entry.values?.[entry.values.length - 1]?.value;
      if (typeof value === "number") insights.push({ metric: entry.name, value });
    }
    return insights;
  }

  /**
   * `GET /{ig-user-id}/insights?period=day` — SOCIAL-05D, account-level.
   * `metrics` should be a subset of the caller's own approved,
   * OFFICIAL_META_DOC_PROVEN account metric list (`reach`, `profile_views` —
   * `INSTAGRAM_ACCOUNT_INSIGHT_METRICS` in `socialAnalyticsSyncExecutor.ts`;
   * every other candidate account metric stayed UNVERIFIED per SOCIAL-05A's
   * own audit and must never be requested here). `period=day` is required
   * for these metrics — unlike a media's lifetime insights, account
   * metrics are periodic and Meta returns them as a `values` array keyed
   * by day, not a single `total_value`.
   *
   * Same discipline as `getInstagramMediaInsights` exactly: never invents a
   * `0` for a metric Meta didn't return a real value for — only entries
   * with an actual numeric `total_value`/`values[].value` are included.
   */
  async getInstagramAccountInsights(igUserId: string, metrics: string[]): Promise<InstagramMediaInsight[]> {
    const result = await this.request<GraphInsightsResponse>(`/${igUserId}/insights`, { metric: metrics.join(","), period: "day" });
    const insights: InstagramMediaInsight[] = [];
    for (const entry of result.data ?? []) {
      const value = entry.total_value?.value ?? entry.values?.[entry.values.length - 1]?.value;
      if (typeof value === "number") insights.push({ metric: entry.name, value });
    }
    return insights;
  }

  /**
   * `POST /{ig-comment-id}/replies?message={message}` — SOCIAL-12B, live-verified
   * against developers.facebook.com/docs/instagram-platform/instagram-graph-api/
   * reference/ig-comment/replies (2026-09-14): the documented way to create a
   * reply to a top-level Instagram comment. Takes the already-persisted
   * `external_comment_id` (SOCIAL-11D's own `instagram_comments` schema)
   * directly — no separate read/lookup call is needed first, since this is
   * exactly the id Meta's own endpoint expects.
   *
   * Meta's own documented limitations are deliberately NOT pre-validated
   * here (only a non-empty `commentId`/`message` is guarded against, a real
   * local-caller-bug case) — matching this provider's existing "let Meta's
   * own response be the source of truth" discipline (see e.g.
   * `getInstagramMediaPermalink`'s own doc comment): only top-level comments
   * can be replied to, a reply to an already-hidden comment is rejected, and
   * a comment on a live video cannot be replied to this way (Meta's own docs
   * point to a DM private reply instead — out of this checkpoint's scope).
   * Any such rejection surfaces as whatever error Meta itself returns,
   * classified downstream exactly like every other `MetaProvider` error
   * (`isMetaAuthError`/`isMetaRateLimitError`/`sanitizeIntegrationError`) —
   * no new error-classification path was added for this method.
   */
  async replyToInstagramComment(commentId: string, message: string): Promise<InstagramCommentReplyResult> {
    if (!commentId.trim()) throw new Error("replyToInstagramComment: commentId is required.");
    if (!message.trim()) throw new Error("replyToInstagramComment: message must not be empty.");
    const result = await this.request<{ id: string }>(`/${commentId}/replies`, { message }, "POST");
    if (typeof result.id !== "string" || !result.id) {
      throw new Error("replyToInstagramComment: Meta returned an unexpected response shape (missing id).");
    }
    return { replyId: result.id };
  }

  /**
   * `POST /{page-id}/messages` — SOCIAL-12B, live-verified against
   * developers.facebook.com/docs/messenger-platform/instagram/features/
   * send-message (2026-09-14): sends a free-form text DM from the connected
   * Instagram professional account. Deliberately keyed on `pageId` (the
   * linked Facebook Page id) rather than `igUserId` — this is Meta's own
   * documented shape for this specific endpoint, unlike
   * `createInstagramMediaContainer`/`publishInstagramMedia`/the insights
   * methods above (all keyed on `ig-user-id`) — matching the existing
   * Facebook-Login-for-Business flow this whole provider is built around
   * (see this file's own header doc comment). Resolving `pageId` is the
   * caller's own responsibility (already stored today in a connection's own
   * `config.meta_page_id` — see `metaAccountActions.ts`); this method does
   * not look it up itself, matching every other method here.
   *
   * `recipientInstagramScopedId` is deliberately named for exactly what it
   * is — the recipient's Instagram-scoped id (IGSID), i.e. SOCIAL-11D's own
   * `instagram_conversations.external_participant_id` — and is never
   * confused with `external_conversation_id` (a different, Meta-optional
   * field this endpoint neither accepts nor needs; see the SOCIAL-12B
   * report's own "read/lookup" scope note for why no separate conversation
   * lookup call was added either).
   *
   * `recipient`/`message` travel as JSON-stringified query-string values —
   * the exact same shape `request()` already uses for every other POST call
   * in this class (see `request()`'s own doc comment); Meta's own documented
   * curl example for this endpoint shows the identical form-encoded shape,
   * so no new request path/body-encoding was added to support this method.
   */
  async sendInstagramDirectMessage(pageId: string, params: { recipientInstagramScopedId: string; text: string }): Promise<InstagramDirectMessageResult> {
    if (!pageId.trim()) throw new Error("sendInstagramDirectMessage: pageId is required.");
    if (!params.recipientInstagramScopedId.trim()) throw new Error("sendInstagramDirectMessage: recipientInstagramScopedId is required.");
    if (!params.text.trim()) throw new Error("sendInstagramDirectMessage: text must not be empty.");
    const result = await this.request<{ recipient_id: string; message_id: string }>(
      `/${pageId}/messages`,
      { recipient: JSON.stringify({ id: params.recipientInstagramScopedId }), message: JSON.stringify({ text: params.text }) },
      "POST",
    );
    if (typeof result.recipient_id !== "string" || !result.recipient_id || typeof result.message_id !== "string" || !result.message_id) {
      throw new Error("sendInstagramDirectMessage: Meta returned an unexpected response shape (missing recipient_id/message_id).");
    }
    return { recipientId: result.recipient_id, messageId: result.message_id };
  }
}
