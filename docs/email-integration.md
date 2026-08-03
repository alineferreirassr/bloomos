# Email Integration (Gmail) — v2 Checkpoint 43

`core/integrations/providers/gmail/gmailProvider.ts` — `GmailProvider implements CommunicationProvider`. A plain `fetch` client against the Gmail API's real `users.messages.send` endpoint, building a base64url-encoded RFC 2822 message (`To`/`Subject`/MIME headers + body) exactly as the real API requires — not the `googleapis` SDK, for the same reason given in `docs/calendar-integration.md`.

## Methods

- `ping()` — `{ok, latencyMs, error?}`.
- `sendEmail({to, subject, body})` → `{externalMessageId, status}`.
- `sendSms()` — throws; Gmail has no SMS capability. Present only because `CommunicationProvider` is one shared interface across email and SMS providers (`TwilioProvider` is the SMS-capable implementer); calling it on `GmailProvider` is a programming error, not a runtime condition to handle gracefully.

## Registration

`modules/integrations/providers/communicationProviders.ts`'s `gmail` entry was updated in place (version bumped, `requiredPermission: "integrations.email"`, description discloses the real adapter). `registerCheckpoint43ProviderFactories.ts` registers the real factory.

## Notification Platform wiring

`modules/integrations/notificationDeliveryProviders.ts` is new: `registerIntegrationNotificationProviders()` registers a real `email` `NotificationProvider` (the Notification Platform's own interface, `core/notifications/registry.ts` — distinct from `core/integrations/sdk.ts`'s `CommunicationProvider`) backed by `GmailProvider`. Because `NotificationDeliveryRequest` carries no workspace context and the registry supports exactly one provider per channel globally, the adapter resolves the correct per-workspace Gmail connection itself: it looks up the recipient member's own `workspace_id` via `getWorkspaceMemberById`, then finds that workspace's connected `gmail` connection. If no Gmail connection exists for that workspace, delivery fails honestly (`{success: false, error: "No connected Gmail account for this workspace."}`) rather than silently no-opping or falling back to a different channel.

## Honest disclosure

No Google OAuth client is configured in this environment — see `docs/oauth-engine.md`'s addendum. The adapter and the Notification Platform wiring are both real and tested against a mocked `fetch`, but unverified against a live Gmail account.

## Not built

Inbound email (reading a mailbox, matching replies to threads) is out of scope — this is send-only, matching the checkpoint's own Non-Goal for auto-reply/inbox-parsing behavior.
