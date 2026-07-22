import type { Notification } from "@/core/notifications/types";
import type { EntityType } from "@/core/enums/entityType";
import type { DataResult } from "@/lib/data/result";

export interface CreateInAppNotificationInput {
  recipientMemberId: string;
  title: string;
  body: string;
  relatedOwnerType?: EntityType | null;
  relatedOwnerId?: string | null;
}

/**
 * Persistence for the one channel with a real stored record in this phase —
 * `in_app`. `email`/`sms`/`push` are architecture-only (see
 * `core/notifications/types.ts`'s `NotificationProvider`), so there's
 * nothing to persist for them yet.
 */
export interface NotificationsRepository {
  getNotificationsForMember(workspaceId: string, recipientMemberId: string): Promise<Notification[]>;
  createInAppNotification(workspaceId: string, input: CreateInAppNotificationInput): Promise<DataResult<Notification>>;
  markNotificationRead(id: string): Promise<DataResult<Notification>>;
}
