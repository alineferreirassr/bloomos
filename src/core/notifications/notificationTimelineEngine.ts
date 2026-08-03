import type { Notification } from "@/core/notifications/types";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

/**
 * v2.0 Checkpoint 41, Step 8 — Notification Timeline Engine. Pure — maps a
 * `Notification` state transition to the Timeline event that documents it,
 * owned by `"notification"` (an `EntityType` reserved since Checkpoint
 * 2/14, given real Timeline events for the first time here). The caller
 * (`modules/notifications/notificationPlatformActions.ts`) is responsible
 * for actually calling `recordTimelineActivity()` with this output —
 * this engine only decides what the event says.
 */

export type NotificationTimelineTransition = "dispatched" | "read" | "archived";

export interface NotificationTimelineEvent {
  ownerType: "notification";
  ownerId: string;
  type: TimelineActivityType;
  description: string;
}

const TRANSITION_TYPE: Record<NotificationTimelineTransition, TimelineActivityType> = {
  dispatched: "notification_dispatched",
  read: "notification_read",
  archived: "notification_archived",
};

const TRANSITION_VERB: Record<NotificationTimelineTransition, string> = {
  dispatched: "was dispatched",
  read: "was marked read",
  archived: "was archived",
};

export function buildNotificationTimelineEvent(notification: Notification, transition: NotificationTimelineTransition): NotificationTimelineEvent {
  return {
    ownerType: "notification",
    ownerId: notification.id,
    type: TRANSITION_TYPE[transition],
    description: `"${notification.title}" ${TRANSITION_VERB[transition]}.`,
  };
}
