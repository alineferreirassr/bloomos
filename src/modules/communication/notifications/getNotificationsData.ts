"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCoreNotificationsService } from "@/core/notifications";
import type { Notification } from "@/core/notifications/types";

const GENERIC_ACCESS_ERROR = "Notifications aren't available. You may not have access to them.";

export interface NotificationCenterData {
  notifications: Notification[];
  unreadCount: number;
}

export type GetNotificationCenterDataResult = { success: true; data: NotificationCenterData } | { success: false; error: string };

/**
 * v2.0 Checkpoint 24, Step 1 — Notification Center's own read. One call to
 * the existing `NotificationsRepository` (Checkpoint 2/14), scoped to the
 * signed-in member — the Notification Center itself does all of its own
 * Unread/Read/Archived/Pinned/Category/Search/Filter slicing client-side
 * over this one already-fetched array (a member's own notifications are a
 * small, bounded list — no server-side pagination needed at this scale,
 * the same call shape `getNotificationsForMember` already had).
 */
export async function getNotificationCenterData(): Promise<GetNotificationCenterDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const notifications = await getCoreNotificationsService().getNotificationsForMember(session.workspace.id, session.membership.id);
  return {
    success: true,
    data: {
      notifications,
      unreadCount: notifications.filter((n) => n.read_at === null && n.archived_at === null).length,
    },
  };
}
