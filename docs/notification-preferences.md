# Notification Preference Engine + Preferences view

## Engine — `core/notifications/preferenceEngine.ts` (Step 5)

Pure — composes the real member-level `NotificationPreferences` (`notificationPreferencesStore.ts`, Checkpoint 24) with `NotificationWorkspaceDefaults`, the workspace-level defaults `modules/settings/sections/notificationsSection.ts` registers but that nothing had ever actually read before this checkpoint (confirmed via repo-wide grep during Step 0's audit). This engine is the first real reader of those five settings, closing a gap rather than inventing a third preferences surface.

`computeNotificationPreferenceDecision(memberPreferences, workspaceDefaults, category, priority, now)` returns:

| Field | Rule |
|---|---|
| `channelsEnabled` | A channel is enabled only when both the workspace-level master switch and the member's own toggle agree (`email`/`push`); `in_app` has no workspace-level switch and always follows the member's own toggle alone; `sms` is member-only in this checkpoint's scope |
| `effectiveDigestFrequency` | `"off"` when `priority === "critical"` and the workspace default says critical alerts bypass the digest; the member's own `digest_frequency` otherwise |
| `withinQuietHours` | Overnight-aware — handles a window like 21:00–08:00 correctly |
| `categoryMuted` | Whether `category` is in the member's `muted_categories` |
| `futureChannelAvailability` | Same `isChannelConfigured()`-backed readiness list `routingEngine.ts` uses |

"Working hours" (the checkpoint spec's own words) is satisfied by the existing `quiet_hours` field — there is no separate working-hours concept for notification delivery anywhere in this codebase; `core/scheduling/workingHoursEngine.ts` models staff shift scheduling, a different domain.

## Preferences view — `/notifications/preferences`

`NotificationPreferencesView.tsx`. Member preferences (Channels, Quiet Hours, Priority rules, Digest, Categories) are editable — every toggle calls `updateNotificationPreferencesForCurrentMemberAction`, the exact same `mockNotificationPreferencesRepository.updatePreferences()` write path Checkpoint 24's own `NotificationPreferencesPanel` uses, just gated on the new `notifications.preferences` permission instead of `communications.view`. Workspace defaults and Future Integrations Status are read-only — editing workspace defaults stays on `/settings` (`workspace.manage`).
