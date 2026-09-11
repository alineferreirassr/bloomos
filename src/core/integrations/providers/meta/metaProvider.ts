import type { BaseProvider } from "@/core/integrations/sdk";
import type { ProviderCapability } from "@/core/integrations/types";

/**
 * SOCIAL-02/03 — a real Meta Graph API adapter (Facebook Login for
 * Business flow). SOCIAL-02 added account/Page/Instagram discovery;
 * SOCIAL-03 adds real Instagram image publishing — video is deliberately
 * not implemented (Meta's own video container API requires
 * asynchronous FINISHED-status polling, "once per minute, for no more
 * than 5 minutes," which is not a safe fit for a single synchronous
 * user-triggered publish request — see SOCIAL-03's own architecture-gate
 * report). No Facebook Page publishing, no carousel, no Stories/Reels.
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

/** True for Meta's own OAuthException shape (expired/invalidated token, revoked permission) — used to report a truthful "reconnect required" state rather than a generic error. */
export function isMetaAuthError(error: unknown): boolean {
  return error instanceof Error && /\b(190|OAuthException|access token)\b/i.test(error.message);
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
}
