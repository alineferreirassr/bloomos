import { NOTIFICATION_KINDS, type NotificationKind, type NotificationPriority } from "@/core/notifications/types";
import type { CommunicationCategory } from "@/types/communication";
import type { CreateInAppNotificationInput } from "@/lib/data/core/notifications/repository";
import type { EntityType } from "@/core/enums/entityType";

/**
 * v2.0 Checkpoint 24, Step 2 — Notification Engine. This is the one place
 * "what does a Lead Created notification look like" is decided — a pure
 * mapping from `NotificationKind` to its default priority/category/icon,
 * plus a single `buildNotificationInput()` that every real call site uses
 * to construct a `CreateInAppNotificationInput`, so no two call sites can
 * silently disagree on a kind's priority or icon. This module never fetches
 * data and never persists anything itself — `getCoreNotificationsService().createInAppNotification()`
 * (Checkpoint 2/14) remains the one write path; this engine only builds the
 * input for it.
 */

export interface NotificationKindMeta {
  label: string;
  icon: string;
  defaultPriority: NotificationPriority;
  defaultCategory: CommunicationCategory;
}

export const NOTIFICATION_KIND_META: Record<NotificationKind, NotificationKindMeta> = {
  lead_created: { label: "Lead Created", icon: "user-plus", defaultPriority: "normal", defaultCategory: "crm" },
  proposal_sent: { label: "Proposal Sent", icon: "send", defaultPriority: "normal", defaultCategory: "crm" },
  proposal_accepted: { label: "Proposal Accepted", icon: "check-circle", defaultPriority: "high", defaultCategory: "crm" },
  invoice_created: { label: "Invoice Created", icon: "file-text", defaultPriority: "normal", defaultCategory: "finance" },
  invoice_paid: { label: "Invoice Paid", icon: "credit-card", defaultPriority: "high", defaultCategory: "finance" },
  payment_failed: { label: "Payment Failed", icon: "alert-triangle", defaultPriority: "critical", defaultCategory: "finance" },
  event_upcoming: { label: "Upcoming Event", icon: "calendar", defaultPriority: "normal", defaultCategory: "operations" },
  inventory_low: { label: "Inventory Alert", icon: "package", defaultPriority: "high", defaultCategory: "inventory" },
  vendor_assigned: { label: "Vendor Assigned", icon: "truck", defaultPriority: "normal", defaultCategory: "operations" },
  workflow_finished: { label: "Workflow Finished", icon: "check-square", defaultPriority: "low", defaultCategory: "automation" },
  automation_failed: { label: "Automation Failed", icon: "alert-octagon", defaultPriority: "high", defaultCategory: "automation" },
  bloom_ai_insight: { label: "Bloom AI Insight", icon: "sparkles", defaultPriority: "normal", defaultCategory: "ai" },
  reminder_due: { label: "Reminder Due", icon: "clock", defaultPriority: "normal", defaultCategory: "communication" },
  comment_mention: { label: "Mentioned You", icon: "at-sign", defaultPriority: "high", defaultCategory: "communication" },
  approval_requested: { label: "Approval Requested", icon: "shield", defaultPriority: "high", defaultCategory: "automation" },
  announcement_published: { label: "Announcement", icon: "megaphone", defaultPriority: "normal", defaultCategory: "communication" },
  message_received: { label: "New Message", icon: "message-circle", defaultPriority: "normal", defaultCategory: "communication" },
  escalation: { label: "Escalation", icon: "alert-triangle", defaultPriority: "critical", defaultCategory: "communication" },
};

export function isNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

export interface BuildNotificationParams {
  kind: NotificationKind;
  recipientMemberId?: string;
  recipientClientAccountId?: string;
  title: string;
  body: string;
  relatedOwnerType?: EntityType | null;
  relatedOwnerId?: string | null;
  /** Overrides the kind's own default — e.g. a Reminder Due notification created by an already-escalated (level > 0) reminder should be `"critical"`, not its normal `"normal"`. */
  priorityOverride?: NotificationPriority;
}

/** The one function every real call site (module-layer code, Automation Actions) uses to build a `CreateInAppNotificationInput` — never construct one by hand with a bare `priority: "normal"` guess. */
export function buildNotificationInput(params: BuildNotificationParams): CreateInAppNotificationInput {
  const meta = NOTIFICATION_KIND_META[params.kind];
  return {
    recipientMemberId: params.recipientMemberId,
    recipientClientAccountId: params.recipientClientAccountId,
    title: params.title,
    body: params.body,
    relatedOwnerType: params.relatedOwnerType ?? null,
    relatedOwnerId: params.relatedOwnerId ?? null,
    kind: params.kind,
    priority: params.priorityOverride ?? meta.defaultPriority,
  };
}
