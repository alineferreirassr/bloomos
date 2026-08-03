# Notification Builder Engine

Checkpoint 41's Step 3 asked for a "Notification Builder Engine — responsible for constructing notifications, pure, deterministic." That engine already exists: `core/communication/notificationEngine.ts`, built in Checkpoint 24, Step 2. Nothing was duplicated for this checkpoint.

## What it does

| Export | Purpose |
|---|---|
| `NOTIFICATION_KIND_META: Record<NotificationKind, NotificationKindMeta>` | The one source of truth mapping each of the 18 `NotificationKind` values to its `label`/`icon`/`defaultPriority`/`defaultCategory` |
| `isNotificationKind(value)` | Type guard |
| `buildNotificationInput(params: BuildNotificationParams)` | Constructs a `CreateInAppNotificationInput` — the one function every real call site (module actions, Automation Actions) uses instead of hand-rolling `priority: "normal"` |

`getCoreNotificationsService().createInAppNotification()` (Checkpoint 2/14) remains the one write path; the Builder Engine only builds the input for it — it never persists anything itself.

## What Checkpoint 41 added on top

`modules/notifications/notificationPlatformActions.ts`'s `createNotificationAction` calls `buildNotificationInput()` directly, then writes through the same real service call and additionally records a `notification_dispatched` Timeline event (see `notification-timeline.md`). No second builder, no second write path.
