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

async function getNotificationsForClientAccount(workspaceId: string, clientAccountId: string): Promise<Notification[]> {
  await delay(100);
  return notifications
    .filter((n) => n.workspace_id === workspaceId && n.recipient_client_account_id === clientAccountId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function getClientPortalNotificationsForWorkspace(workspaceId: string): Promise<Notification[]> {
  await delay(100);
  return notifications
    .filter((n) => n.workspace_id === workspaceId && n.recipient_client_account_id !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function createInAppNotification(
  workspaceId: string,
  input: CreateInAppNotificationInput,
): Promise<DataResult<Notification>> {
  if (input.title.trim().length === 0) {
    return fail("Please fix the highlighted fields.", { title: "Title is required" });
  }
  if (!input.recipientMemberId && !input.recipientClientAccountId) {
    return fail("Please fix the highlighted fields.", { recipient: "A recipient member or client account is required" });
  }

  const notification: Notification = {
    id: generateId("notification"),
    workspace_id: workspaceId,
    recipient_member_id: input.recipientMemberId ?? null,
    recipient_client_account_id: input.recipientClientAccountId ?? null,
    channel: "in_app",
    title: input.title,
    body: input.body,
    read_at: null,
    created_at: nowIso(),
    related_owner_type: input.relatedOwnerType ?? null,
    related_owner_id: input.relatedOwnerId ?? null,
    kind: input.kind ?? null,
    priority: input.priority ?? "normal",
    pinned_at: null,
    archived_at: null,
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

async function markNotificationUnread(id: string): Promise<DataResult<Notification>> {
  const existing = notifications.find((n) => n.id === id);
  if (!existing) return fail("Notification not found.");
  if (existing.read_at === null) return ok(existing);

  const updated: Notification = { ...existing, read_at: null };
  notifications = notifications.map((n) => (n.id === id ? updated : n));
  return ok(updated);
}

async function markAllNotificationsRead(workspaceId: string, recipientMemberId: string): Promise<DataResult<number>> {
  const now = nowIso();
  let count = 0;
  notifications = notifications.map((n) => {
    if (n.workspace_id === workspaceId && n.recipient_member_id === recipientMemberId && n.read_at === null) {
      count += 1;
      return { ...n, read_at: now };
    }
    return n;
  });
  return ok(count);
}

async function pinNotification(id: string): Promise<DataResult<Notification>> {
  const existing = notifications.find((n) => n.id === id);
  if (!existing) return fail("Notification not found.");
  const updated: Notification = { ...existing, pinned_at: existing.pinned_at ?? nowIso() };
  notifications = notifications.map((n) => (n.id === id ? updated : n));
  return ok(updated);
}

async function unpinNotification(id: string): Promise<DataResult<Notification>> {
  const existing = notifications.find((n) => n.id === id);
  if (!existing) return fail("Notification not found.");
  const updated: Notification = { ...existing, pinned_at: null };
  notifications = notifications.map((n) => (n.id === id ? updated : n));
  return ok(updated);
}

async function archiveNotification(id: string): Promise<DataResult<Notification>> {
  const existing = notifications.find((n) => n.id === id);
  if (!existing) return fail("Notification not found.");
  const updated: Notification = { ...existing, archived_at: existing.archived_at ?? nowIso() };
  notifications = notifications.map((n) => (n.id === id ? updated : n));
  return ok(updated);
}

async function unarchiveNotification(id: string): Promise<DataResult<Notification>> {
  const existing = notifications.find((n) => n.id === id);
  if (!existing) return fail("Notification not found.");
  const updated: Notification = { ...existing, archived_at: null };
  notifications = notifications.map((n) => (n.id === id ? updated : n));
  return ok(updated);
}

async function getMemberNotificationsForWorkspace(workspaceId: string): Promise<Notification[]> {
  await delay(100);
  return notifications
    .filter((n) => n.workspace_id === workspaceId && n.recipient_member_id !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export const mockNotificationsRepository: NotificationsRepository = {
  getNotificationsForMember,
  getNotificationsForClientAccount,
  getClientPortalNotificationsForWorkspace,
  getMemberNotificationsForWorkspace,
  createInAppNotification,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  pinNotification,
  unpinNotification,
  archiveNotification,
  unarchiveNotification,
};
