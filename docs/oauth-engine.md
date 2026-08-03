# OAuth Engine

v2 Checkpoint 22, Step 6 (`core/integrations/oauthEngine.ts`) — the one handshake *shape* every future OAuth-capable provider would use, built entirely from `ProviderDefinition.oauth` metadata so no provider-specific code lives here.

## The stop condition, honored precisely

Per this checkpoint's own explicit stop condition, this engine never makes a real HTTP call: it never redirects a browser to a real `authorizationEndpoint`, and never POSTs to a real `tokenEndpoint`. What it does do is real, local bookkeeping:

- **`generateOAuthState()`** — a real, cryptographically random CSRF `state` token (`crypto.getRandomValues`).
- **`generatePkcePair()`** — a real PKCE `code_verifier`/`code_challenge` pair using RFC 7636's `S256` method (`crypto.subtle.digest`) — the only method every PKCE-supporting provider also supports, so the engine never bothers offering the weaker `plain` method.
- **`beginAuthorization()`** — builds the *exact* URL a browser would be sent to (from `provider.oauth.authorizationEndpoint` + `response_type`/`redirect_uri`/`state`/`scope`/PKCE params), stores a `PendingAuthorization` record, and returns the URL — never navigates to it or fetches it.
- **`completeAuthorization()`** — accepts the token values a real callback route would already hold (exchanged from the provider's own `tokenEndpoint` by code this checkpoint never writes), validates the pending request hasn't expired or already been consumed, and mints a real `IntegrationCredential` via `credentialManager.issueOAuthCredential()`.

## Pending authorization lifecycle

```
beginAuthorization()  →  PendingAuthorization { state, provider_id, connection_id, code_verifier, expires_at }
                              │
                    (10-minute TTL, in-memory)
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                             ▼
completeAuthorization(state, tokens)          cancelAuthorization(state)
   → issues an IntegrationCredential             → discarded, no credential
   → the pending record is consumed exactly once
```

A replayed or expired `state` throws — the same CSRF discipline a real callback route needs regardless of which provider it's for.

## API

```ts
generateOAuthState(): string
generatePkcePair(): Promise<{ codeVerifier: string; codeChallenge: string }>
beginAuthorization(params: { workspaceId, connectionId, providerId, redirectUri }): Promise<{ authorizationUrl: string; state: string }>
getPendingAuthorization(state: string): PendingAuthorization | null
completeAuthorization(params: { state, createdBy, accessToken, refreshToken?, expiresAt?, scopes? }): Promise<{ credential, connectionId, providerId }>
cancelAuthorization(state: string): void
listPendingAuthorizationsForWorkspace(workspaceId: string): PendingAuthorization[]
resetOAuthEngine(): void // test-only
```

## Known limitation

An in-flight pending authorization is held in a plain in-memory array — a Node process restart mid-handshake loses it, the same "mock-only phase, not silently glossed over" limitation `deliverWithRetry` (Checkpoint 17) already documented for its own in-process retry loop.


## v2 Checkpoint 43 additions

`core/integrations/oauthTokenExchange.ts` is new: `exchangeAuthorizationCode()` and `refreshOAuthToken()` perform a real HTTP POST to each provider's real token endpoint (Google, DocuSign) — but only when that provider's OAuth client id/secret are present as environment variables. With no env vars configured (true in this environment), both functions return `{configured: false, reason}` rather than fabricating a token — an honest "not wired to a real client" disclosure, never a silent mock success. `modules/integrations/manageOAuthConnectionActions.ts` wires this into the existing `oauthEngine.ts` pending-authorization flow: `completeProviderOAuthConnectionAction` peeks at the pending authorization, performs the real exchange, and only then calls `completeAuthorization()` + `issueOAuthCredential()` — an unconfigured OAuth client leaves the pending state valid for retry rather than consuming it on a failed exchange.
