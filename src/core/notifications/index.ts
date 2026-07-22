import type { NotificationsRepository } from "@/lib/data/core/notifications/repository";
import { mockNotificationsRepository } from "@/lib/data/core/notifications/mockRepository";

export type { Notification, NotificationChannel, NotificationProvider, NotificationDeliveryRequest } from "@/core/notifications/types";
export { NOTIFICATION_CHANNELS } from "@/core/notifications/types";
export { registerNotificationProvider, getNotificationProvider, isChannelConfigured } from "@/core/notifications/registry";
export type { NotificationsRepository, CreateInAppNotificationInput } from "@/lib/data/core/notifications/repository";

/** In-app notifications only — mock-only this phase (same rationale as `core/tags`). */
export function getCoreNotificationsService(): NotificationsRepository {
  return mockNotificationsRepository;
}
