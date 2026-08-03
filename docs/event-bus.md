# Event Bus

v2 Checkpoint 22, Step 9 (`core/integrations/eventBus.ts`) — internal, in-process pub/sub, the "every module communicates through" backbone the checkpoint's own spec names.

## Why a new vocabulary, not `WebhookEventType` reused

Deliberately a *superset* vocabulary from `WebhookEventType` (Checkpoint 17), not a reuse of it. This checkpoint's own research found:

- Only 11 of 17 catalogued `WebhookEventType`s ever actually fire from a real call site (`publishWebhookEvent` is called for them somewhere in the app).
- Of the 6 example events this checkpoint's own spec names as things "every module communicates through" — `invoice.paid`, `proposal.accepted`, `event.completed`, `inventory.reserved`, `vendor.assigned`, `client.created` — only 2 (`invoice.paid`, `proposal.accepted`) have a same-named `WebhookEventType` today. `event.completed` has no webhook equivalent at all (only `event.created` exists); `inventory.reserved` and `vendor.assigned` are genuinely new business moments this checkpoint's own spec names, with no webhook catalog entry to match.

`IntegrationEventType` is that superset — a 6-value closed union matching the spec's own named examples exactly (`INTEGRATION_EVENT_TYPES` in `core/integrations/types.ts`).

## The bridge

`publishIntegrationEvent()` does two things on every call:

1. Fans the event out to every internal subscriber (`subscribeToIntegrationEvent()`), entirely in-process, never blocking the caller.
2. Calls `bridgesToWebhook(type)` — `true` only when `type` also exists in `WEBHOOK_EVENT_TYPES` — and if so, also calls `publishWebhookEvent()`, so external subscribers keep receiving exactly what they already do. It never fabricates a webhook event that doesn't exist in Checkpoint 17's own closed catalog.

```
publishIntegrationEvent({ type: "vendor.assigned", ... })
   → internal subscribers only (no WebhookEventType "vendor.assigned" exists)

publishIntegrationEvent({ type: "invoice.paid", ... })
   → internal subscribers
   → publishWebhookEvent (same-named WebhookEventType exists)
```

## API

```ts
subscribeToIntegrationEvent<T>(type: IntegrationEventType, handler: IntegrationEventHandler<T>): () => void  // returns an unsubscribe function
publishIntegrationEvent<T>(params: { type, workspaceId, resourceId?, payload: T }): void
bridgesToWebhook(type: IntegrationEventType): boolean
resetEventBus(): void // test-only
```

A handler that throws — synchronously or via a rejected Promise — is caught and logged here, never propagated back to the publisher. One broken subscriber can never break another subscriber or the business action that triggered the event, the same discipline `publishWebhookEvent` already established for its own delivery loop.

## Known limitation

Subscriptions are held in-memory only — they don't survive a process restart, and there is no persistence of "who was subscribed to what." A future checkpoint building durable subscriptions (e.g., a Workflow trigger node keyed off an `IntegrationEventType`) would need its own persisted registration, not a read of this in-memory `Map`.


## v2 Checkpoint 43 additions

9 new `IntegrationEventType` values were added for the new providers (`calendar.event_changed`, `email.delivered`, `email.bounced`, `sms.delivered`, `sms.failed`, `signature.completed`, `signature.declined`, `storage.file_synced`, `connection.failed`) — all internal-only, per this doc's own "only bridges to `publishWebhookEvent` where a same-named `WebhookEventType` genuinely exists" rule, since no `WebhookEventType` catalog entry exists yet for any of them. They reach the rest of the platform instead through 9 new Workflow trigger nodes (`modules/workflow/nodes/triggerNodes.ts`) and 9 new `AUTOMATION_TRIGGER_TYPES` values dispatched directly by `webhookEventProcessing.ts` — a parallel path, not a retrofit of the Event Bus itself.
