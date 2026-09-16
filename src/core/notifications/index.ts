import type { NotificationsRepository } from "@/lib/data/core/notifications/repository";
import { mockNotificationsRepository } from "@/lib/data/core/notifications/mockRepository";
import { supabaseNotificationsRepository } from "@/lib/data/core/notifications/supabaseRepository";
import { selectRepository } from "@/lib/data/provider";

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

/**
 * SOCIAL-13J — in-app notifications now have a real Supabase-backed
 * repository (`supabaseRepository.ts`) sitting alongside the mock one,
 * selected the same single, centralized way every other module already
 * routes through (`selectRepository`, `lib/data/provider.ts`) — never a
 * second branch on `NEXT_PUBLIC_DATA_MODE` scattered elsewhere.
 */
export function getCoreNotificationsService(): NotificationsRepository {
  return selectRepository({ mock: mockNotificationsRepository, supabase: supabaseNotificationsRepository });
}
