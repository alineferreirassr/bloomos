import type { Notification } from "@/core/notifications/types";
import type { CreateInAppNotificationInput, NotificationsRepository } from "@/lib/data/core/notifications/repository";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso, delay } from "@/lib/data/utils";

let notifications: Notification[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetNotificationsStore(): void {
  notifications = [];
}

async function getNotificationsForMember(workspaceId: string, recipientMemberId: string): Promise<Notification[]> {
  await delay(100);
  return notifications
    .filter((n) => n.workspace_id === workspaceId && n.recipient_member_id === recipientMemberId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function createInAppNotification(
  workspaceId: string,
  input: CreateInAppNotificationInput,
): Promise<DataResult<Notification>> {
  if (input.title.trim().length === 0) {
    return fail("Please fix the highlighted fields.", { title: "Title is required" });
  }

  const notification: Notification = {
    id: generateId("notification"),
    workspace_id: workspaceId,
    recipient_member_id: input.recipientMemberId,
    channel: "in_app",
    title: input.title,
    body: input.body,
    read_at: null,
    created_at: nowIso(),
    related_owner_type: input.relatedOwnerType ?? null,
    related_owner_id: input.relatedOwnerId ?? null,
  };
  notifications = [...notifications, notification];
  return ok(notification);
}

async function markNotificationRead(id: string): Promise<DataResult<Notification>> {
  const existing = notifications.find((n) => n.id === id);
  if (!existing) return fail("Notification not found.");
  if (existing.read_at !== null) return ok(existing);

  const updated: Notification = { ...existing, read_at: nowIso() };
  notifications = notifications.map((n) => (n.id === id ? updated : n));
  return ok(updated);
}

export const mockNotificationsRepository: NotificationsRepository = {
  getNotificationsForMember,
  createInAppNotification,
  markNotificationRead,
};
