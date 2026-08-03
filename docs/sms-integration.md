# SMS / Messaging Integration (Twilio) — v2 Checkpoint 43

`core/integrations/providers/twilio/twilioProvider.ts` — `TwilioProvider implements CommunicationProvider, WebhookProvider`. A plain `fetch` client against Twilio's real REST API (`api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json`), authenticated with HTTP Basic Auth (Account SID + Auth Token) exactly as Twilio's own API requires — no `twilio` npm SDK, for the same reason given in `docs/calendar-integration.md`.

## Methods

- `ping()` — `{ok, latencyMs, error?}`.
- `sendSms({to, body})` → `{externalMessageId, status}`.
- `sendEmail()` — throws; Twilio (as configured here) is SMS-only, the mirror image of `GmailProvider.sendSms()`.
- `normalizePhoneNumber(raw)` — exported helper, normalizes to E.164 for outbound sends and inbound webhook matching.
- `verifyInboundSignature({rawBody, signatureHeader, secret})` (via `WebhookProvider`) — real Twilio HMAC-SHA1 signature verification: sorts the form-encoded body's keys, concatenates `key+value` pairs, HMAC-SHA1s with the Auth Token, base64-encodes, and compares to `X-Twilio-Signature`.

## Credential shape

The connection's `provider_secret` credential packs three values as `"accountSid:authToken:fromNumber"` — unpacked by `registerCheckpoint43ProviderFactories.ts` when constructing the real adapter, and by the inbound webhook route when verifying a signature.

## Inbound webhook

`/api/webhooks/twilio/[connectionId]` — see `docs/webhook-engine.md`'s Checkpoint 43 addendum for the full route contract.

## Registration

`modules/integrations/providers/messagingProviders.ts` is new: registers `twilio` (category `"messaging"`, capabilities `["communication", "webhook"]`, `requiredPermission: "integrations.messaging"`).

## Honest disclosure

No live Twilio account is connected in this environment. The adapter's HTTP call shape and its inbound signature verification are both real (tested against a mocked `fetch` and real HMAC computation), but unverified against Twilio's live API.

## Not built

SMS delivery through the Notification Platform is explicitly **not wired** — `TeamMember` has no `phone` field in this schema, and adding one is a schema change outside this checkpoint's "extend, don't redesign core entities" scope (see `docs/v2-checkpoint-43.md`'s classification table). `TwilioProvider.sendSms()` is real and callable directly by future code that does have a phone number; it is not reachable today from `registerIntegrationNotificationProviders()`.
