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
 * Graph API version is pinned to `v26.0`, the current latest stable
 * release (2026-07-29) as of this checkpoint, verified against Meta's own
 * live developer documentation rather than assumed from training data —
 * see the SOCIAL-02/03 architecture-gate reports for the full evidence
 * trail. Bump this constant (and re-verify against developers.facebook.com)
 * the next time this provider is touched, mirroring how every other
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
}
