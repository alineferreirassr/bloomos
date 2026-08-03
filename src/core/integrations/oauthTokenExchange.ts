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
  gmail: { idVar: "GOOGLE_OAUTH_CLIENT_ID", secretVar: "GOOGLE_OAUTH_CLIENT_SECRET" },
  "google-drive": { idVar: "GOOGLE_OAUTH_CLIENT_ID", secretVar: "GOOGLE_OAUTH_CLIENT_SECRET" },
  docusign: { idVar: "DOCUSIGN_OAUTH_CLIENT_ID", secretVar: "DOCUSIGN_OAUTH_CLIENT_SECRET" },
  dropbox: { idVar: "DROPBOX_OAUTH_CLIENT_ID", secretVar: "DROPBOX_OAUTH_CLIENT_SECRET" },
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
