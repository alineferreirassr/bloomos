"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCoreNotificationsService } from "@/core/notifications";
import { requireOwnedNotification } from "@/modules/notifications/notificationPlatformActions";
import type { DataResult } from "@/lib/data/result";
import type { Notification } from "@/core/notifications/types";

const GENERIC_ACCESS_ERROR = "Notifications aren't available. You may not have access to them.";
const NOT_FOUND_ERROR = "Notification not found.";

async function requireCommunicationsAccess() {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return null;
  return session;
}

/**
 * Phase 09D — every single-id action below now confirms `id` is really one of
 * the caller's own notifications (via `notificationPlatformActions.ts`'s
 * shared `requireOwnedNotification`) before mutating it. Previously these
 * actions trusted any id the client passed, scoped only by the (correct)
 * assumption that a well-behaved client only ever passes ids it already
 * fetched — a client that didn't play along could mutate another member's,
 * or another workspace's, notification. This file's own permission gate
 * (`communications.view`) is unchanged; only the missing ownership check is
 * added, so nothing that could already do this legitimately loses access.
 * `markAllNotificationsReadAction` needed no change — it was already
 * workspace+member scoped by construction.
 */

export async function markNotificationReadAction(id: string): Promise<DataResult<Notification>> {
  const session = await requireCommunicationsAccess();
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedNotification(id, session.workspace.id, session.membership.id))) return { success: false, error: NOT_FOUND_ERROR };
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
  if (!(await requireOwnedNotification(id, session.workspace.id, session.membership.id))) return { success: false, error: NOT_FOUND_ERROR };
  return getCoreNotificationsService().pinNotification(id);
}

export async function unpinNotificationAction(id: string): Promise<DataResult<Notification>> {
  const session = await requireCommunicationsAccess();
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedNotification(id, session.workspace.id, session.membership.id))) return { success: false, error: NOT_FOUND_ERROR };
  return getCoreNotificationsService().unpinNotification(id);
}

export async function archiveNotificationAction(id: string): Promise<DataResult<Notification>> {
  const session = await requireCommunicationsAccess();
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedNotification(id, session.workspace.id, session.membership.id))) return { success: false, error: NOT_FOUND_ERROR };
  return getCoreNotificationsService().archiveNotification(id);
}

/** The Notification Center's "Undo" affordance right after a dismiss. */
export async function undoArchiveNotificationAction(id: string): Promise<DataResult<Notification>> {
  const session = await requireCommunicationsAccess();
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedNotification(id, session.workspace.id, session.membership.id))) return { success: false, error: NOT_FOUND_ERROR };
  return getCoreNotificationsService().unarchiveNotification(id);
}
