import { isChannelConfigured } from "@/core/notifications/registry";
import { NOTIFICATION_CHANNELS, type NotificationChannel } from "@/core/notifications/types";
import type { NotificationPreferences, DigestFrequency, CommunicationCategory } from "@/types/communication";
import type { NotificationDeliveryReadiness } from "@/types/notificationPlatform";

/**
 * v2.0 Checkpoint 41, Step 5 — Notification Preference Engine. Pure —
 * composes the real member-level `NotificationPreferences`
 * (`notificationPreferencesStore.ts`, Checkpoint 24) with the workspace-
 * level defaults `modules/settings/sections/notificationsSection.ts`
 * already registers but nothing has ever actually read (confirmed via
 * repo-wide grep during this checkpoint's Step 0 audit) — this engine is
 * the first real reader, closing that gap rather than inventing a third
 * preferences surface.
 *
 * "Working hours" (the checkpoint spec's own words) is the existing
 * `quiet_hours` field on `NotificationPreferences` — there's no separate
 * working-hours concept for notification delivery anywhere in this
 * codebase; `core/scheduling/workingHoursEngine.ts` models staff shift
 * scheduling, a different domain, and reusing it here would conflate the
 * two rather than extend either.
 */

export interface NotificationWorkspaceDefaults {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  digestFrequency: DigestFrequency;
  criticalAlertsBypassDigest: boolean;
}

export interface NotificationPreferenceDecision {
  channelsEnabled: NotificationChannel[];
  effectiveDigestFrequency: DigestFrequency;
  withinQuietHours: boolean;
  categoryMuted: boolean;
  futureChannelAvailability: NotificationDeliveryReadiness[];
}

function isWithinQuietHours(preferences: NotificationPreferences, now: Date): boolean {
  if (!preferences.quiet_hours.enabled) return false;
  const hour = now.getHours();
  const { startHour, endHour } = preferences.quiet_hours;
  if (startHour === endHour) return false;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  // Overnight window (e.g. 21 -> 8): true on either side of midnight.
  return hour >= startHour || hour < endHour;
}

function computeFutureChannelAvailability(): NotificationDeliveryReadiness[] {
  return NOTIFICATION_CHANNELS.map((channel) => ({
    channel,
    configured: isChannelConfigured(channel),
    reason: isChannelConfigured(channel) ? null : "No delivery provider registered for this channel yet.",
  }));
}

/**
 * Channel is enabled only when both the workspace-level master switch and
 * the member's own per-channel toggle agree — the same "narrower gate
 * wins" precedent `communications.view` vs. route-level gating already
 * uses elsewhere in this codebase. `in_app` has no workspace-level
 * disable switch (`notificationsSection.ts` never registered one — the
 * Notification Center itself would have nothing to show a member without
 * it), so it always follows the member's own `in_app_enabled` alone.
 */
export function computeNotificationPreferenceDecision(
  memberPreferences: NotificationPreferences,
  workspaceDefaults: NotificationWorkspaceDefaults,
  category: CommunicationCategory,
  priority: "low" | "normal" | "high" | "critical",
  now: Date,
): NotificationPreferenceDecision {
  const channelsEnabled: NotificationChannel[] = [
    ...(memberPreferences.in_app_enabled ? (["in_app"] as const) : []),
    ...(memberPreferences.email_enabled && workspaceDefaults.emailEnabled ? (["email"] as const) : []),
    ...(memberPreferences.push_enabled && workspaceDefaults.pushEnabled ? (["push"] as const) : []),
    ...(memberPreferences.sms_enabled ? (["sms"] as const) : []),
  ];

  const bypassesDigest = priority === "critical" && workspaceDefaults.criticalAlertsBypassDigest;

  return {
    channelsEnabled,
    effectiveDigestFrequency: bypassesDigest ? "off" : memberPreferences.digest_frequency,
    withinQuietHours: isWithinQuietHours(memberPreferences, now),
    categoryMuted: memberPreferences.muted_categories.includes(category),
    futureChannelAvailability: computeFutureChannelAvailability(),
  };
}
