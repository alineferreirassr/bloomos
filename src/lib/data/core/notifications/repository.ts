import type { Notification, NotificationKind, NotificationPriority } from "@/core/notifications/types";
import type { EntityType } from "@/core/enums/entityType";
import type { DataResult } from "@/lib/data/result";

/**
 * Exactly one of `recipientMemberId` / `recipientClientAccountId` must be
 * set (Checkpoint 14, Step 9) — enforced by the repository implementation,
 * not the type system, the same "validated at the one write path" shape
 * `CreateTemplateInput` etc. already use elsewhere in this codebase.
 */
export interface CreateInAppNotificationInput {
  recipientMemberId?: string;
  recipientClientAccountId?: string;
  title: string;
  body: string;
  relatedOwnerType?: EntityType | null;
  relatedOwnerId?: string | null;
  /** Checkpoint 24, Step 2 — omitted defaults to `null`/`"normal"` (see `notificationEngine.ts`'s own kind→priority defaults). */
  kind?: NotificationKind | null;
  priority?: NotificationPriority;
}

/**
 * Persistence for the one channel with a real stored record in this phase —
 * `in_app`. `email`/`sms`/`push` are architecture-only (see
 * `core/notifications/types.ts`'s `NotificationProvider`), so there's
 * nothing to persist for them yet.
 */
export interface NotificationsRepository {
  getNotificationsForMember(workspaceId: string, recipientMemberId: string): Promise<Notification[]>;
  /** Checkpoint 14 — the Client Portal's own Notification Center read path. */
  getNotificationsForClientAccount(workspaceId: string, clientAccountId: string): Promise<Notification[]>;
  /** Checkpoint 16, Step 9 — every Client Portal notification across a Workspace's accounts, for the Public API (which has no single "current" account to scope to). Never includes internal-member notifications (`recipient_member_id` rows). */
  getClientPortalNotificationsForWorkspace(workspaceId: string): Promise<Notification[]>;
  /** Checkpoint 24 — every member-recipient notification across a Workspace, for the workspace-wide Activity Feed. Never includes Client Portal notifications (`recipient_client_account_id` rows) — the mirror image of `getClientPortalNotificationsForWorkspace`. */
  getMemberNotificationsForWorkspace(workspaceId: string): Promise<Notification[]>;
  createInAppNotification(workspaceId: string, input: CreateInAppNotificationInput): Promise<DataResult<Notification>>;
  markNotificationRead(id: string): Promise<DataResult<Notification>>;
  /** v2.0 Checkpoint 41 — the read-state mirror of `markNotificationRead`, genuinely missing until now (nothing before this checkpoint ever needed to move a notification back to unread). */
  markNotificationUnread(id: string): Promise<DataResult<Notification>>;
  /** Checkpoint 24, Step 1 — Notification Center bulk actions and state transitions, each a targeted update on the rows it touches. */
  markAllNotificationsRead(workspaceId: string, recipientMemberId: string): Promise<DataResult<number>>;
  pinNotification(id: string): Promise<DataResult<Notification>>;
  unpinNotification(id: string): Promise<DataResult<Notification>>;
  archiveNotification(id: string): Promise<DataResult<Notification>>;
  /** Reverses `archiveNotification` — the Notification Center's "Undo" affordance right after a dismiss. */
  unarchiveNotification(id: string): Promise<DataResult<Notification>>;
}
