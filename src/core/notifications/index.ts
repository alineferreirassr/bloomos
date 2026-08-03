import type { NotificationsRepository } from "@/lib/data/core/notifications/repository";
import { mockNotificationsRepository } from "@/lib/data/core/notifications/mockRepository";

export type { Notification, NotificationChannel, NotificationProvider, NotificationDeliveryRequest, NotificationKind, NotificationPriority } from "@/core/notifications/types";
export { NOTIFICATION_CHANNELS, NOTIFICATION_KINDS, NOTIFICATION_PRIORITIES } from "@/core/notifications/types";
export { registerNotificationProvider, getNotificationProvider, isChannelConfigured } from "@/core/notifications/registry";
export type { NotificationQueue, NotificationQueueItem } from "@/core/notifications/queue";
export { inMemoryNotificationQueue, setActiveNotificationQueue, getActiveNotificationQueue } from "@/core/notifications/queue";
export type { NotificationsRepository, CreateInAppNotificationInput } from "@/lib/data/core/notifications/repository";
export {
  listNotificationTemplates,
  getNotificationTemplate,
  getNotificationTemplateForKind,
  getNotificationTemplateHistory,
  createNotificationTemplate,
} from "@/lib/data/core/notifications/templateStore";
export type { CreateNotificationTemplateInput } from "@/lib/data/core/notifications/templateStore";
export { resolveNotificationTemplate, findUnknownEmailTemplatePlaceholders, previewNotificationContent } from "@/core/notifications/emailTemplateEngine";
export type { ResolvedNotificationContent } from "@/core/notifications/emailTemplateEngine";

/** In-app notifications only — mock-only this phase (same rationale as `core/tags`). */
export function getCoreNotificationsService(): NotificationsRepository {
  return mockNotificationsRepository;
}
