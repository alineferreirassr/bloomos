# Notification Routing Engine

`core/notifications/routingEngine.ts` — Checkpoint 41, Step 4. Pure — takes an already-created `Notification` plus (optionally) the recipient's own `NotificationPreferences` and computes a `NotificationRoutingDecision`. Never sends anything.

## `computeNotificationRouting(notification, preferences?)`

| Field | How it's computed |
|---|---|
| `category` | `NOTIFICATION_KIND_META[notification.kind].defaultCategory`, or `"communication"` when `kind` is `null` |
| `visible` / `suppressedReason` | `false` once archived; `false` when the category is in `preferences.muted_categories`; `false` when `priority` is below `preferences.minimum_priority`; `true` (no preferences at all defaults to visible) otherwise |
| `expiresAt` | Advisory only — `null` for `critical`/`high` priority, a 30-day window from `created_at` for `low`/`normal`. Nothing purges on this date; see Known Limitations below |
| `deliveryReadiness` | One `NotificationDeliveryReadiness` per `NotificationChannel`, wrapping `isChannelConfigured()` (`core/notifications/registry.ts`) — never a second "is this channel real" check |

## Known Limitations

- **Expiry is advisory, not enforced.** No background worker or cron job archives an expired notification (forbidden by this checkpoint's own Stop Conditions). A future checkpoint that adds a real digest/cleanup worker should read `expiresAt` rather than reinventing the 30-day rule.
- **`Notification` has no `category` field.** Routing always derives it fresh from `kind`; if a future checkpoint stores category directly, `routingEngine.ts` is the one place to update.
