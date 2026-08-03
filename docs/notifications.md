# Notification Center

v2.0 Checkpoint 41. The single new-namespace entry point for notifications, built entirely on top of the real storage, delivery-registry, and Notification Engine Checkpoints 2/14/24 already shipped — nothing here duplicates a store, a permission gate, or a builder.

## Reuse map (Step 0 audit)

| Already real (Checkpoint 2/14/24) | This checkpoint's role |
|---|---|
| `core/notifications/{types,registry,queue}.ts` — `Notification` storage type, `NotificationProvider` delivery registry, `NotificationQueue` | Reused unchanged everywhere; `isChannelConfigured()` is the one "future delivery readiness" primitive |
| `core/communication/notificationEngine.ts` — `buildNotificationInput()`, `NOTIFICATION_KIND_META` | This **is** the Notification Builder Engine (Step 3); no second builder |
| `lib/data/core/notifications/mockRepository.ts` + `modules/communication/notifications/{notificationActions,getNotificationsData}.ts` | Extended with one genuinely missing method (`markNotificationUnread`); the existing `/communications` tab keeps working unchanged, still gated on `communications.view` |
| `types/communication.ts`'s `NotificationPreferences` + `notificationPreferencesStore.ts` | Reused as the member-preferences store; `NotificationCategory` is a type alias for `CommunicationCategory`, never a second enum |
| `activityAdapters.ts`'s `notificationsSource` | Unchanged — notifications still feed the Activity Feed one-directionally |

## What's genuinely new

- **Domain types** (`types/notificationPlatform.ts`, `types/notificationHealth.ts`, `types/notificationAnalytics.ts`) — `NotificationTemplate`, `NotificationRoutingDecision`, `NotificationDeliveryReadiness`, `NotificationDigest`, health/analytics report shapes.
- **Template store** (`lib/data/core/notifications/templateStore.ts`) — one system template per `NotificationKind`, versioned, with real (if currently unused) create infrastructure.
- **Engines** (`core/notifications/*.ts`) — Routing, Preference, Health, Analytics, Timeline, Knowledge Graph, Executive Decisions. See each engine's own doc.
- **Module actions** (`modules/notifications/notificationPlatformActions.ts`) — the new `notifications.*`-permission-gated action layer.
- **UI** — `/notifications`, `/notifications/[id]`, `/notifications/preferences`, `/notifications/templates`. See `docs/notification-dashboard.md`.
- **Permissions** — `notifications.view/manage/templates/preferences`, additive to `communications.view/manage`. See `docs/notification-permissions.md`.

## What this checkpoint explicitly does NOT build

Per its own Stop Conditions: no email/SMS/push sending, no background workers, no cron jobs, no WebSockets, no real delivery. `isChannelConfigured()` reports every non-`in_app` channel as unconfigured today — that's the honest, expected state until a future checkpoint registers a real `NotificationProvider`.

## Docs index

- `notification-builder.md` — the (pre-existing) Notification Builder Engine
- `notification-routing.md` — Notification Routing Engine
- `notification-preferences.md` — Notification Preference Engine + Preferences view
- `notification-health.md` — Notification Health Engine + Business Health / Executive Decisions wiring
- `notification-analytics.md` — Notification Analytics Engine
- `notification-dashboard.md` — the 4 UI routes
- `notification-templates.md` — Template Library
- `notification-timeline.md` — Timeline + Knowledge Graph integration
- `notification-permissions.md` — the 4 new permissions
- `v2-checkpoint-41.md` — final certification report
