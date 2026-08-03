import type { EntityType } from "@/core/enums/entityType";

export const NOTIFICATION_CHANNELS = ["in_app", "email", "sms", "push"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * v2.0 Checkpoint 24 — Communication Platform, Step 2. A closed vocabulary
 * of "why this notification exists," used for icon/label resolution,
 * grouping, and Notification Preferences' per-category rules. Deliberately
 * separate from `related_owner_type` (what it links to) — a `payment_failed`
 * notification's `kind` never changes, but its `related_owner_type` is
 * always `"payment"`. `null` covers every notification created before this
 * checkpoint (all of them, today) and any future kind this list hasn't
 * caught up to yet — never a required field to keep writing to.
 */
export const NOTIFICATION_KINDS = [
  "lead_created",
  "proposal_sent",
  "proposal_accepted",
  "invoice_created",
  "invoice_paid",
  "payment_failed",
  "event_upcoming",
  "inventory_low",
  "vendor_assigned",
  "workflow_finished",
  "automation_failed",
  "bloom_ai_insight",
  "reminder_due",
  "comment_mention",
  "approval_requested",
  "announcement_published",
  "message_received",
  "escalation",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_PRIORITIES = ["low", "normal", "high", "critical"] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

/**
 * A notification the workspace decided to send — not the delivery itself.
 * `channel` records which channel it was routed through; only `in_app` is a
 * real, stored, readable notification in this phase (it's the one channel
 * that needs no external delivery provider — it's just a row a member reads
 * in-app). `related_owner_type`/`related_owner_id` are optional so a
 * notification can link back to the entity that triggered it (e.g. "Invoice
 * #204 is overdue" → the Invoice) without being required to.
 *
 * Checkpoint 14, Step 9 — exactly one of `recipient_member_id` /
 * `recipient_client_account_id` is ever set, never both: a `ClientAccount`
 * is never a `workspace_members` row (see `types/clientAccount.ts`'s own
 * doc comment), so a client recipient needs its own optional column rather
 * than overloading the member one. Additive only — every existing,
 * member-only caller (`createNotificationAction.ts`) is unaffected.
 *
 * Checkpoint 24, Step 1 — `kind`/`priority`/`pinned_at`/`archived_at` are
 * additive: every notification created by any prior checkpoint simply has
 * `kind: null`, `priority: "normal"`, `pinned_at: null`, `archived_at: null`,
 * and continues to read/display exactly as before.
 */
export interface Notification {
  id: string;
  workspace_id: string;
  recipient_member_id: string | null;
  recipient_client_account_id: string | null;
  channel: NotificationChannel;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  related_owner_type: EntityType | null;
  related_owner_id: string | null;
  kind: NotificationKind | null;
  priority: NotificationPriority;
  pinned_at: string | null;
  archived_at: string | null;
}

/**
 * A delivery request handed to a channel's provider — deliberately
 * separate from `Notification` (the stored record) since a `NotificationProvider`
 * shouldn't need to know about `id`/`read_at`/persistence at all, only what
 * to send and to whom.
 *
 * v2 Checkpoint 44, Step 6 — widened to mirror `Notification`'s own
 * `recipient_member_id` / `recipient_client_account_id` split: exactly one
 * of `recipientMemberId` / `recipientClientAccountId` is ever set, the same
 * "member XOR client" contract the storage layer already enforces in
 * `createInAppNotification()`. A provider's own `send()` resolves contact
 * info from whichever one is present.
 */
export interface NotificationDeliveryRequest {
  recipientMemberId?: string;
  recipientClientAccountId?: string;
  title: string;
  body: string;
}

/**
 * The provider-agnostic delivery contract. No implementation exists for
 * `email`/`sms`/`push` yet — this interface is what a future SendGrid/Twilio/
 * FCM adapter implements and registers (see `registry.ts`), so the rest of
 * BloomOS never imports a vendor SDK directly.
 */
export interface NotificationProvider {
  channel: NotificationChannel;
  send(request: NotificationDeliveryRequest): Promise<{ success: true } | { success: false; error: string }>;
}
