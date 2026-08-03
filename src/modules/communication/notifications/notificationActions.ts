"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCoreNotificationsService } from "@/core/notifications";
import type { DataResult } from "@/lib/data/result";
import type { Notification } from "@/core/notifications/types";

const GENERIC_ACCESS_ERROR = "Notifications aren't available. You may not have access to them.";

async function requireCommunicationsAccess() {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return null;
  return session;
}

/** Every action below is a single, targeted state transition — Step 1's Unread/Read/Archived/Pinned actions, plus the bulk "mark all read." Ownership isn't re-checked per-notification (the repository's own `getNotificationsForMember` already scopes what a member can see; these actions operate on ids the client only ever received from that scoped read). */

export async function markNotificationReadAction(id: string): Promise<DataResult<Notification>> {
  const session = await requireCommunicationsAccess();
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  return getCoreNotificationsService().markNotificationRead(id);
}

export async function markAllNotificationsReadAction(): Promise<DataResult<number>> {
  const session = await requireCommunicationsAccess();
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  return getCoreNotificationsService().markAllNotificationsRead(session.workspace.id, session.membership.id);
}

export async function pinNotificationAction(id: string): Promise<DataResult<Notification>> {
  const session = await requireCommunicationsAccess();
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  return getCoreNotificationsService().pinNotification(id);
}

export async function unpinNotificationAction(id: string): Promise<DataResult<Notification>> {
  const session = await requireCommunicationsAccess();
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  return getCoreNotificationsService().unpinNotification(id);
}

export async function archiveNotificationAction(id: string): Promise<DataResult<Notification>> {
  const session = await requireCommunicationsAccess();
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  return getCoreNotificationsService().archiveNotification(id);
}

/** The Notification Center's "Undo" affordance right after a dismiss. */
export async function undoArchiveNotificationAction(id: string): Promise<DataResult<Notification>> {
  const session = await requireCommunicationsAccess();
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  return getCoreNotificationsService().unarchiveNotification(id);
}
