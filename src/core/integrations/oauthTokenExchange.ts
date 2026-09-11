/**
 * v2 Checkpoint 43 — a real OAuth 2.0 authorization-code token exchange
 * against a provider's real token endpoint (`ProviderOAuthMetadata.
 * tokenEndpoint`, already declared for every OAuth-capable provider in
 * the Provider Registry). This is the one piece Checkpoint 22's own
 * `oauthEngine.ts` explicitly left for "a future checkpoint" — that
 * engine only does the state/PKCE bookkeeping around a real handshake,
 * never the handshake's own outbound HTTP call. This file is that call.
 *
 * Every OAuth-capable provider this checkpoint adds needs its own
 * registered app (client id/secret) with the provider — Google Cloud
 * Console, DocuSign's developer portal, etc. Those are read from
 * per-provider environment variables, never hardcoded, never requested
 * in chat. If unset, `exchangeAuthorizationCode`/`refreshOAuthToken`
 * return an honest `{ configured: false }` result rather than throwing
 * or fabricating a token — this is the exact "provider-ready but
 * unverified" state disclosed on every affected `ProviderDefinition`.
 */
export interface OAuthClientCredentials {
  clientId: string;
  clientSecret: string;
}

const OAUTH_CLIENT_ENV_VARS: Record<string, { idVar: string; secretVar: string }> = {
  "google-calendar": { idVar: "GOOGLE_OAUTH_CLIENT_ID", secretVar: "GOOGLE_OAUTH_CLIENT_SECRET" },
  // GCAL-02 — the same Google Cloud OAuth client as `google-calendar`/`gmail` above; a real
  // Google OAuth client can issue tokens for multiple scopes/consent flows, so this reuses the
  // existing env vars rather than requiring a second registered Google app.
  "google-calendar-readonly": { idVar: "GOOGLE_OAUTH_CLIENT_ID", secretVar: "GOOGLE_OAUTH_CLIENT_SECRET" },
  gmail: { idVar: "GOOGLE_OAUTH_CLIENT_ID", secretVar: "GOOGLE_OAUTH_CLIENT_SECRET" },
  "google-drive": { idVar: "GOOGLE_OAUTH_CLIENT_ID", secretVar: "GOOGLE_OAUTH_CLIENT_SECRET" },
  docusign: { idVar: "DOCUSIGN_OAUTH_CLIENT_ID", secretVar: "DOCUSIGN_OAUTH_CLIENT_SECRET" },
  dropbox: { idVar: "DROPBOX_OAUTH_CLIENT_ID", secretVar: "DROPBOX_OAUTH_CLIENT_SECRET" },
  // SOCIAL-02 — Meta's own registered app (Facebook Login for Business).
  meta: { idVar: "META_OAUTH_CLIENT_ID", secretVar: "META_OAUTH_CLIENT_SECRET" },
};

export function resolveOAuthClientCredentials(providerId: string): OAuthClientCredentials | null {
  const varNames = OAUTH_CLIENT_ENV_VARS[providerId];
  if (!varNames) return null;
  const clientId = process.env[varNames.idVar];
  const clientSecret = process.env[varNames.secretVar];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export type TokenExchangeResult = { configured: true; accessToken: string; refreshToken: string | null; expiresInSeconds: number | null } | { configured: false; reason: string };

export async function exchangeAuthorizationCode(params: { providerId: string; tokenEndpoint: string; code: string; redirectUri: string; codeVerifier?: string }): Promise<TokenExchangeResult> {
  const credentials = resolveOAuthClientCredentials(params.providerId);
  if (!credentials) return { configured: false, reason: `No OAuth client is configured for "${params.providerId}" in this environment.` };

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    ...(params.codeVerifier ? { code_verifier: params.codeVerifier } : {}),
  });
  const response = await fetch(params.tokenEndpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`OAuth token exchange failed for "${params.providerId}": ${response.status} ${errorBody.slice(0, 200)}`);
  }
  const result = (await response.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  return { configured: true, accessToken: result.access_token, refreshToken: result.refresh_token ?? null, expiresInSeconds: result.expires_in ?? null };
}

export async function refreshOAuthToken(params: { providerId: string; tokenEndpoint: string; refreshToken: string }): Promise<TokenExchangeResult> {
  const credentials = resolveOAuthClientCredentials(params.providerId);
  if (!credentials) return { configured: false, reason: `No OAuth client is configured for "${params.providerId}" in this environment.` };

  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: params.refreshToken, client_id: credentials.clientId, client_secret: credentials.clientSecret });
  const response = await fetch(params.tokenEndpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`OAuth token refresh failed for "${params.providerId}": ${response.status} ${errorBody.slice(0, 200)}`);
  }
  const result = (await response.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  return { configured: true, accessToken: result.access_token, refreshToken: result.refresh_token ?? params.refreshToken, expiresInSeconds: result.expires_in ?? null };
}

/**
 * SOCIAL-02 — Meta's real code-exchange shape does not fit
 * `exchangeAuthorizationCode`'s generic assumption (a `POST` with a
 * form-urlencoded body and a `grant_type=authorization_code` value).
 * Verified against Meta's own current developer documentation (Graph API
 * v26.0, the latest stable version as of this checkpoint) rather than
 * assumed from memory:
 *
 * 1. `GET {tokenEndpoint}?client_id=...&redirect_uri=...&client_secret=...&code=...`
 *    — a plain `GET` with querystring params, no `grant_type` at all —
 *    exchanges the authorization `code` for a short-lived (~1-2 hour)
 *    user access token.
 * 2. `GET {tokenEndpoint}?grant_type=fb_exchange_token&client_id=...&client_secret=...&fb_exchange_token=<short-lived token>`
 *    — immediately exchanges that short-lived token for a long-lived
 *    (~60 day) user access token. Meta has no separate `refresh_token`
 *    value at all; the long-lived token itself is what gets re-extended
 *    later (see `manageOAuthConnectionActions.ts`'s own comment on why
 *    Meta's `refreshProviderOAuthConnectionAction` path is left to report
 *    "reconnect" honestly rather than faking a refresh-token flow that
 *    doesn't exist for this provider).
 *
 * Only the long-lived token is ever returned/persisted — the short-lived
 * token exists only for the duration of this one function call. This
 * still returns the exact same `TokenExchangeResult` shape every other
 * provider's exchange does, so no caller-side type ever needs to know
 * this happened in two HTTP calls instead of one.
 */
export async function exchangeMetaAuthorizationCode(params: { tokenEndpoint: string; code: string; redirectUri: string }): Promise<TokenExchangeResult> {
  const credentials = resolveOAuthClientCredentials("meta");
  if (!credentials) return { configured: false, reason: 'No OAuth client is configured for "meta" in this environment.' };

  const codeExchangeUrl = new URL(params.tokenEndpoint);
  codeExchangeUrl.searchParams.set("client_id", credentials.clientId);
  codeExchangeUrl.searchParams.set("redirect_uri", params.redirectUri);
  codeExchangeUrl.searchParams.set("client_secret", credentials.clientSecret);
  codeExchangeUrl.searchParams.set("code", params.code);

  const codeResponse = await fetch(codeExchangeUrl, { method: "GET" });
  if (!codeResponse.ok) {
    const errorBody = await codeResponse.text().catch(() => "");
    throw new Error(`OAuth token exchange failed for "meta": ${codeResponse.status} ${errorBody.slice(0, 200)}`);
  }
  const shortLived = (await codeResponse.json()) as { access_token: string };

  const longLivedUrl = new URL(params.tokenEndpoint);
  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
  longLivedUrl.searchParams.set("client_id", credentials.clientId);
  longLivedUrl.searchParams.set("client_secret", credentials.clientSecret);
  longLivedUrl.searchParams.set("fb_exchange_token", shortLived.access_token);

  const longLivedResponse = await fetch(longLivedUrl, { method: "GET" });
  if (!longLivedResponse.ok) {
    const errorBody = await longLivedResponse.text().catch(() => "");
    throw new Error(`Long-lived token exchange failed for "meta": ${longLivedResponse.status} ${errorBody.slice(0, 200)}`);
  }
  const longLived = (await longLivedResponse.json()) as { access_token: string; expires_in?: number };

  return { configured: true, accessToken: longLived.access_token, refreshToken: null, expiresInSeconds: longLived.expires_in ?? null };
}
