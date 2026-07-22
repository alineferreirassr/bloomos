import type { EntityType } from "@/core/enums/entityType";

export const NOTIFICATION_CHANNELS = ["in_app", "email", "sms", "push"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * A notification the workspace decided to send — not the delivery itself.
 * `channel` records which channel it was routed through; only `in_app` is a
 * real, stored, readable notification in this phase (it's the one channel
 * that needs no external delivery provider — it's just a row a member reads
 * in-app). `related_owner_type`/`related_owner_id` are optional so a
 * notification can link back to the entity that triggered it (e.g. "Invoice
 * #204 is overdue" → the Invoice) without being required to.
 */
export interface Notification {
  id: string;
  workspace_id: string;
  recipient_member_id: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  related_owner_type: EntityType | null;
  related_owner_id: string | null;
}

/**
 * A delivery request handed to a channel's provider — deliberately
 * separate from `Notification` (the stored record) since a `NotificationProvider`
 * shouldn't need to know about `id`/`read_at`/persistence at all, only what
 * to send and to whom.
 */
export interface NotificationDeliveryRequest {
  recipientMemberId: string;
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
