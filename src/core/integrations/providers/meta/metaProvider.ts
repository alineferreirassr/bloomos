import type { BaseProvider } from "@/core/integrations/sdk";
import type { ProviderCapability } from "@/core/integrations/types";

/**
 * SOCIAL-02 — a real Meta Graph API adapter (Facebook Login for Business
 * flow), account/provider foundation only — no publishing capability yet.
 *
 * Graph API version is pinned to `v26.0`, the current latest stable
 * release (2026-07-29) as of this checkpoint, verified against Meta's own
 * live developer documentation rather than assumed from training data —
 * see the SOCIAL-02 architecture-gate report for the full evidence trail.
 * Bump this constant (and re-verify against developers.facebook.com) the
 * next time this provider is touched, mirroring how every other
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

  private async request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${GRAPH_API_BASE}${path}`);
    url.searchParams.set("access_token", this.accessToken);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const response = await fetch(url);
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
}
