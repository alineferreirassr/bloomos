# Integration Security — v2 Checkpoint 43

## Secret redaction

`core/integrations/errorSanitizer.ts` — `redactSecrets(text)` and `sanitizeIntegrationError(error)`. Every error message that could reach the Audit Log, Timeline, Analytics, or Diagnostics is passed through this first. `redactSecrets` matches both bare-token patterns (long alphanumeric runs after `key`/`secret`/`token`/`password`/`auth`, with or without a surrounding quote — `apiKey: "sk_live_..."` and `apiKey=sk_live_...` both match) and replaces the matched value with `[REDACTED]`, never the whole message (so an operator debugging a real failure still sees *which* field was the problem, just not its value). `IntegrationErrorRecord.message` (stored by `insertErrorRecord`) is always the sanitized string — the raw error is never persisted anywhere.

## No raw secrets in ordinary records

Every credential — OAuth access/refresh token, Twilio Auth Token, DocuSign Connect HMAC secret — is stored exclusively through `credentialManager.ts`'s `issueOAuthCredential`/`issueProviderSecretCredential`, behind an opaque `secretRef` resolved only server-side by `resolveAccessToken`/`resolveProviderSecret`. `IntegrationConnection.config` (a `Record<string, string|number|boolean>` read by client-facing dashboards) never holds a secret value directly — the DocuSign webhook secret, for example, lives in `config.webhook_secret_credential_id`, a credential *id*, not the secret itself.

## No token exposed to the client

`getIntegrationsDashboardData.ts` and `getIntegrationConnectionDetail.ts` return `IntegrationConnection` rows as-is — which is safe specifically because `IntegrationConnection` itself never carries a secret (`credential_id` is an opaque reference). Neither aggregator calls `resolveAccessToken`/`resolveProviderSecret` for display purposes; those functions are used only server-side, inside a Server Action or an inbound webhook route, never to build a value returned to a client component.

## Real webhook signature verification, not a shared static secret

Twilio (`X-Twilio-Signature`, HMAC-SHA1 against the connection's own Auth Token) and DocuSign (`X-DocuSign-Signature-1`, HMAC-SHA256 against a Connect-specific secret) both verify a real, per-connection cryptographic signature before touching the payload — matching Stripe's own inbound route from Checkpoint 23. An invalid or missing signature returns 400 and records a `recordWebhookRejection` audit entry; it never reaches `processGenericWebhookEvent`.

## No silent auto-send / auto-charge / two-way sync

Every new adapter is a thin, explicit call — `sendEmail`, `sendSms`, `createSignatureRequest`, `uploadFile` — invoked only from a Server Action a user or an Automation Action explicitly triggers. Nothing in this checkpoint polls an external provider and mutates BloomOS data unprompted; `syncEngine.ts`'s existing one-way, last-write-wins model (Checkpoint 22, unchanged) is the only sync behavior in play.

## No fabricated "connected" verification

Every new adapter's own doc file states plainly that no live account is connected in this environment. `dropbox` has no adapter at all rather than a fake one (`docs/storage-integration.md`). `oauthTokenExchange.ts` returns `{configured: false, reason}` when no OAuth client env vars exist, rather than minting a fake successful token exchange (`docs/oauth-engine.md`'s addendum).

## No production account connected without authorization

No environment variable for any of the 5 new providers is set in this repository's `.env.local`/`.env.example`; no live credential entry flow was exercised. Connecting a real account remains an explicit, user-initiated action outside this checkpoint's own scope.
