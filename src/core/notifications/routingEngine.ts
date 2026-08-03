import { NOTIFICATION_CHANNELS, NOTIFICATION_PRIORITIES, type Notification } from "@/core/notifications/types";
import { isChannelConfigured } from "@/core/notifications/registry";
import { NOTIFICATION_KIND_META } from "@/core/communication/notificationEngine";
import type { NotificationPreferences } from "@/types/communication";
import type { NotificationCategory, NotificationDeliveryReadiness, NotificationRoutingDecision } from "@/types/notificationPlatform";

/**
 * v2.0 Checkpoint 41, Step 4 — Notification Routing Engine. Pure — takes an
 * already-created `Notification` plus (optionally) the recipient's own
 * `NotificationPreferences` (Checkpoint 24, Step 3) and computes where it
 * would go, at what priority/category, whether it's currently visible to
 * its recipient, and how ready each channel is to actually deliver it.
 * Never sends anything — `deliveryReadiness` wraps
 * `isChannelConfigured()` (`registry.ts`), the same provider-registry this
 * checkpoint's own Stop Conditions require it to reuse rather than
 * reimplement.
 */

const PRIORITY_RANK: Record<(typeof NOTIFICATION_PRIORITIES)[number], number> = { low: 0, normal: 1, high: 2, critical: 3 };

/** `Notification` itself has no `category` field (only `kind`) — this is the same computed derivation `NOTIFICATION_KIND_META` already anchors every default-category decision to; a `kind`-less notification (rare — only hand-built ones without a registered kind) falls back to `"communication"`, the catch-all category `reminder_due`/`comment_mention`/`message_received` already use. */
function categoryForNotification(notification: Notification): NotificationCategory {
  if (notification.kind) return NOTIFICATION_KIND_META[notification.kind].defaultCategory;
  return "communication";
}

function computeDeliveryReadiness(): NotificationDeliveryReadiness[] {
  return NOTIFICATION_CHANNELS.map((channel) => ({
    channel,
    configured: isChannelConfigured(channel),
    reason: isChannelConfigured(channel) ? null : "No delivery provider registered for this channel yet — see core/notifications/registry.ts.",
  }));
}

/** Advisory only — nothing purges an expired notification today (see `docs/notification-routing.md`'s Known Limitations). `critical`/`high` priority notifications never expire; `low`/`normal` ones get a 30-day advisory window from creation. */
function computeExpiresAt(notification: Notification): string | null {
  if (notification.priority === "critical" || notification.priority === "high") return null;
  const createdAt = new Date(notification.created_at);
  createdAt.setDate(createdAt.getDate() + 30);
  return createdAt.toISOString();
}

function computeVisibility(notification: Notification, category: NotificationCategory, preferences: NotificationPreferences | null): { visible: boolean; suppressedReason: string | null } {
  if (notification.archived_at !== null) return { visible: false, suppressedReason: "Notification is archived." };
  if (!preferences) return { visible: true, suppressedReason: null };
  if (preferences.muted_categories.includes(category)) return { visible: false, suppressedReason: `Recipient has muted the "${category}" category.` };
  if (PRIORITY_RANK[notification.priority] < PRIORITY_RANK[preferences.minimum_priority]) {
    return { visible: false, suppressedReason: `Below recipient's minimum priority threshold ("${preferences.minimum_priority}").` };
  }
  return { visible: true, suppressedReason: null };
}

export function computeNotificationRouting(notification: Notification, preferences: NotificationPreferences | null = null): NotificationRoutingDecision {
  const category = categoryForNotification(notification);
  const { visible, suppressedReason } = computeVisibility(notification, category, preferences);

  return {
    notificationId: notification.id,
    recipientMemberId: notification.recipient_member_id,
    recipientClientAccountId: notification.recipient_client_account_id,
    channel: notification.channel,
    priority: notification.priority,
    category,
    visible,
    suppressedReason,
    expiresAt: computeExpiresAt(notification),
    deliveryReadiness: computeDeliveryReadiness(),
  };
}
