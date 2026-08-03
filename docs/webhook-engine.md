# Webhook Engine

The Webhook Engine is Checkpoint 17's own platform (`core/webhooks/`) — signing, dispatch, retry with real exponential backoff, Delivery History, Replay, and delivery Metrics. See `docs/webhooks.md` for the full original architecture and `docs/webhook-events.md` for the event catalog. This document covers what v2 Checkpoint 22, Step 7 ("Extend Webhook Engine") added.

## What already existed before this checkpoint

This checkpoint's own research confirmed the Webhook Engine already had, live, from Checkpoint 17:

- A real terminal `dead_letter` status (`WebhookDelivery.status`) once every retry attempt is exhausted.
- Real exponential backoff (1s → 2s → 4s → 8s → 16s, capped at 60s, 5 attempts) — `core/webhooks/retryEngine.ts`.
- **Replay** — `replayWebhookDeliveryAction()` resends the *literal* stored `request_body` bytes through the same Dispatcher, producing a new, linked `WebhookDelivery` record.
- **Metrics** — `summarizeWebhookDeliveries()` returns total/success/failure/dead-letter/retry counts, average latency, and a per-endpoint breakdown, already surfaced in the Developer Console's own Deliveries tab summary strip.

## What Step 7 added

1. **A formalized Dead Letter Queue read** — `core/webhooks/deadLetterQueue.ts`'s `listDeadLetterDeliveries(workspaceId)`. Never a second store: it filters the exact same `WebhookDelivery` records `listWebhookDeliveriesForWorkspace` already returns. Before this, every caller filtered the full history table by eye; this formalizes that filter into one function so the Developer Console's own Dead Letter Queue view and a future Integration Dashboard card both read the exact same list.
2. **Bulk Replay** — `replayAllDeadLetterDeliveriesAction()` (`modules/webhooks/manageWebhookDeliveriesActions.ts`) reuses `replayWebhookDeliveryAction()` per delivery rather than reimplementing the auth check or the `deliverWithRetry` call. One delivery's replay failing never stops the rest.
3. **A Dead Letter Queue filter in the Deliveries tab UI** (`modules/webhooks/components/DeliveriesTab.tsx`) — a checkbox that narrows the table to `dead_letter`-status rows only, plus a "Replay all (N)" button that only renders when `summary.deadLetterCount > 0`.

## Retry Engine delegation (Step 10)

`core/webhooks/retryEngine.ts`'s own `computeBackoffDelayMs(attempt)` now delegates its arithmetic to the new shared `core/integrations/retryEngine.ts` — see `docs/retry-engine.md`. The formula and every constant (1s base, 60s cap, 5 attempts, no jitter) are byte-for-byte unchanged; this is a pure delegation, not a behavior change, confirmed by Webhooks' own existing test suite passing without modification.

## Event Bus bridge (Step 9)

The new internal Event Bus (`core/integrations/eventBus.ts`) bridges to `publishWebhookEvent` for any `IntegrationEventType` that has a same-named `WebhookEventType` — see `docs/event-bus.md`. This never changes what a webhook subscriber receives; it's an additional internal publisher, not a new external behavior.

## Known limitation

Bulk Replay has no rate limiting of its own — replaying a large Dead Letter Queue re-runs the full retry sequence (including real backoff delays) for every delivery, sequentially, inside the one Server Action call. Fine at mock-data volumes; a real deployment would want this on the Queue Engine instead of inline.


## v2 Checkpoint 43 additions

Two new real inbound webhook routes, `/api/webhooks/twilio/[connectionId]` and `/api/webhooks/docusign/[connectionId]`, follow the exact shape Checkpoint 23 established for Stripe: verify a real provider signature (`X-Twilio-Signature` HMAC-SHA1 against the connection's own Auth Token; `X-DocuSign-Signature-1` HMAC-SHA256 against a separate Connect secret set via `setDocuSignWebhookSecretAction`), create a real Queue Engine job, call `modules/integrations/webhookEventProcessing.ts`'s `processGenericWebhookEvent()`, and never return a 5xx for a processing failure (only for signature/config failures, matching Stripe's own contract). `webhookEventProcessing.ts` is new: it dispatches a real `AutomationTriggerEvent` for any mapped event and records a redacted audit entry via `recordConnectionAuditEvent` — it is not a new webhook *outbound* subsystem, it is the inbound counterpart Checkpoint 22's `IntegrationEventType` vocabulary was missing.
