# Notification Analytics Engine

`core/notifications/notificationAnalyticsEngine.ts` — Checkpoint 41, Step 7. Pure — every metric is derived from a `Notification[]` the caller already fetched, the same "engine returns numbers, view formats them" discipline `core/search/searchAnalyticsEngine.ts` established.

## Metrics

| Field | Notes |
|---|---|
| `totalCreated` / `totalRead` / `totalUnread` / `totalArchived` / `totalPinned` / `totalHighPriority` | `totalUnread` excludes archived, matching `getNotificationCenterData`'s own `unreadCount` definition; `totalHighPriority` counts `high` + `critical` together |
| `totalDismissed` | An honest alias for `totalArchived` — `Notification` has no separate `dismissed_at` field; the Notification Center's "Undo dismiss" is undoing an archive, not a distinct dismissal state |
| `averageResponseSeconds` | `null`, not fabricated, when nothing has been read yet |
| `averageNotificationAgeSeconds` | Average age of every non-archived notification, as of `evaluatedAt` |
| `deliveryReadinessRate` | Fraction of channels with `isChannelConfigured() === true` |
| `engagementRate` | `read / total`, `0` with no notifications |
| `trend` | Splits by creation order (not calendar time), compares the older half's engagement to the newer half's; `"steady"` for samples under 4 |
| `byCategory` / `byKind` | Counts grouped via `NOTIFICATION_KIND_META` |

Wired into `/notifications`'s Analytics tab via `evaluateNotificationAnalyticsAction()`.
