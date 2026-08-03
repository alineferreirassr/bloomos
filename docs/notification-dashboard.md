# Notification Center UI

v2.0 Checkpoint 41, Steps 13–16. Four routes under `src/app/(app)/notifications`, components under `src/modules/notifications/components/`. Additive to `/communications`'s own `notifications` tab (`NotificationCenterPanel`, Checkpoint 24), which keeps working unchanged.

## Routes

| Route | Component | Gate |
|---|---|---|
| `/notifications` | `NotificationDashboardView` | `notifications.view` |
| `/notifications/[id]` | `NotificationDetailView` | `notifications.view` |
| `/notifications/preferences` | `NotificationPreferencesView` | `notifications.preferences` |
| `/notifications/templates` | `NotificationTemplatesView` | `notifications.templates` |

## NotificationDashboardView (`/notifications`)

KPI cards (Unread/Today/High Priority/Pinned/Archived) plus a 10-tab `Tabs`/`TabList`/`TabPanel` shell (the same accessible, roving-tabindex primitive `components/ui/Tabs.tsx` provides): Unread, Today, High Priority, Pinned, Archived (each a filtered notification list with Mark read/unread, Pin/Unpin, Dismiss actions), Analytics (KPI cards + by-category/by-kind breakdowns from `evaluateNotificationAnalyticsAction`), Health (category scores + findings from `evaluateNotificationHealthAction`), Templates (a preview list linking to the full library), Preferences (a summary card linking to the full editor), and Recent Activity (the notification's own Timeline events, via `getNotificationDashboardDataAction`).

## NotificationDetailView (`/notifications/[id]`)

Metadata, Routing & future delivery (channel readiness + quiet-hours/digest state), Template, Knowledge Graph (the related-entity activity summary), and Timeline & history — all from one `getNotificationDetailAction()` call. Analytics and Health are workspace-wide composites, not a per-notification metric — this view links to the Dashboard's own tabs instead of fabricating a per-item number.

## NotificationPreferencesView / NotificationTemplatesView

See `docs/notification-preferences.md` and `docs/notification-templates.md`.

## Design system reuse

Every view composes existing shared primitives only — `PageHeader`, `KpiCard`, `Card`, `Badge`, `Tabs`, `TableSkeleton`, `Skeleton`, `ErrorState`, `EmptyState` — plus one new icon (`NotificationsIcon`) added to `components/ui/icons.tsx` following that file's own lucide-react wrapping pattern. No new design-system component was introduced.
