import type { EntityType } from "@/core/enums/entityType";
import type { NotificationPriority } from "@/core/notifications/types";

/**
 * v2.0 Checkpoint 24 — Communication & Collaboration Platform. This is the
 * one shared type file for the whole checkpoint, the same role
 * `types/businessIntelligence.ts` played for Checkpoint 23 — every engine
 * and store below imports from here rather than redeclaring its own
 * closed vocabulary.
 */

// ---------------------------------------------------------------------------
// Reminder Engine (Step 9)
// ---------------------------------------------------------------------------

export const REMINDER_RECURRENCES = ["none", "daily", "weekly", "monthly"] as const;
export type ReminderRecurrence = (typeof REMINDER_RECURRENCES)[number];

export const REMINDER_STATUSES = ["pending", "completed", "snoozed", "dismissed"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const REMINDER_PRIORITIES = ["low", "normal", "high", "critical"] as const;
export type ReminderPriority = (typeof REMINDER_PRIORITIES)[number];

export const REMINDER_CATEGORIES = ["follow_up", "task", "meeting", "deadline", "personal", "other"] as const;
export type ReminderCategory = (typeof REMINDER_CATEGORIES)[number];

/** Optionally tied to any entity (`owner_type`/`owner_id`, both null for a plain personal reminder) so a reminder can surface on that entity's Communication Timeline. */
export interface Reminder {
  id: string;
  workspace_id: string;
  created_by_member_id: string;
  assigned_to_member_id: string;
  title: string;
  notes: string | null;
  due_at: string;
  recurrence: ReminderRecurrence;
  priority: ReminderPriority;
  category: ReminderCategory;
  status: ReminderStatus;
  snoozed_until: string | null;
  escalation_level: number;
  owner_type: EntityType | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// ---------------------------------------------------------------------------
// Announcements (Step 8)
// ---------------------------------------------------------------------------

export const ANNOUNCEMENT_PRIORITIES = ["normal", "important", "critical"] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];

/** `"everyone"` or a specific role subset — an announcement never targets individual members (that's what Internal Messaging is for). */
export const ANNOUNCEMENT_AUDIENCES = ["everyone", "owner_admin", "managers", "staff"] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export interface Announcement {
  id: string;
  workspace_id: string;
  author_member_id: string;
  author_name: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  publish_at: string;
  expires_at: string | null;
  requires_acknowledgement: boolean;
  acknowledged_member_ids: string[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Internal Messaging / Unified Inbox (Steps 4, 12)
// ---------------------------------------------------------------------------

/** `"direct"` = exactly 2 participant members; `"team"` = 2+; `"client_portal"` rows are never created here — they're read from the existing `clientPortalMessageStore` and merged into the Inbox at the read layer only. */
export const MESSAGE_THREAD_KINDS = ["direct", "team"] as const;
export type MessageThreadKind = (typeof MESSAGE_THREAD_KINDS)[number];

export interface InternalMessageThread {
  id: string;
  workspace_id: string;
  kind: MessageThreadKind;
  subject: string | null;
  participant_member_ids: string[];
  created_by_member_id: string;
  pinned_by_member_ids: string[];
  archived_by_member_ids: string[];
  last_message_at: string;
  created_at: string;
}

export interface InternalMessageAttachment {
  name: string;
  url: string;
}

export interface InternalMessage {
  id: string;
  thread_id: string;
  author_member_id: string;
  author_name: string;
  body: string;
  mentioned_member_ids: string[];
  attachments: InternalMessageAttachment[];
  read_by_member_ids: string[];
  created_at: string;
}

/** Unified Inbox's own normalized row — merges Internal Messaging threads with Client Portal threads (Checkpoint 14) at read time, never a third write-side store. */
export const INBOX_ITEM_SOURCES = ["internal_message", "client_portal_message"] as const;
export type InboxItemSource = (typeof INBOX_ITEM_SOURCES)[number];

export interface InboxItem {
  id: string;
  source: InboxItemSource;
  subject: string | null;
  previewBody: string;
  participantLabel: string;
  unreadCount: number;
  pinned: boolean;
  archived: boolean;
  lastMessageAt: string;
  href: string;
}

// ---------------------------------------------------------------------------
// Presence (Step 11)
// ---------------------------------------------------------------------------

export const PRESENCE_STATUSES = ["online", "away", "busy", "dnd", "offline"] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

/** `manual_status` (busy/dnd) always wins over the derived online/away/offline read of `last_active_at` — see `presenceEngine.deriveStatus`. */
export interface MemberPresence {
  member_id: string;
  workspace_id: string;
  last_active_at: string;
  manual_status: "busy" | "dnd" | null;
}

// ---------------------------------------------------------------------------
// Notification Preferences (Step 3)
// ---------------------------------------------------------------------------

export const DIGEST_FREQUENCIES = ["off", "daily", "weekly"] as const;
export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number];

export interface QuietHours {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

export interface NotificationPreferences {
  workspace_id: string;
  member_id: string;
  desktop_enabled: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  quiet_hours: QuietHours;
  muted_categories: CommunicationCategory[];
  minimum_priority: NotificationPriority;
  digest_frequency: DigestFrequency;
}

// ---------------------------------------------------------------------------
// Activity / Communication Timeline (Steps 7, 7.5)
// ---------------------------------------------------------------------------

export const COMMUNICATION_CATEGORIES = [
  "crm",
  "finance",
  "operations",
  "inventory",
  "automation",
  "ai",
  "documents",
  "communication",
] as const;
export type CommunicationCategory = (typeof COMMUNICATION_CATEGORIES)[number];

/**
 * One normalized row in the Activity Feed / Communication Timeline. Every
 * `ActivitySourceAdapter` (see `core/communication/activityRegistry.ts`)
 * maps its own domain's rows into this shape — the Feed and the Timeline
 * are the *same* aggregation at two different scopes (see `activityAggregator.ts`'s
 * own doc comment), so this type is shared by both.
 */
export interface ActivityEntry {
  id: string;
  workspaceId: string;
  category: CommunicationCategory;
  /** Free-form within a category (e.g. "comment_created", "invoice_paid", "workflow_published") — not a second closed enum on top of `TimelineActivityType`/`NotificationKind`, since this row is often a passthrough of one of those. */
  kind: string;
  title: string;
  description: string | null;
  actorLabel: string;
  actorMemberId: string | null;
  occurredAt: string;
  ownerType: EntityType | null;
  ownerId: string | null;
  /** Cross-references — "the Communication Graph" in data form (see `docs/communication-graph.md`): who/what generated this entry, so a Timeline entry can always answer "why does this exist." */
  relatedAutomationExecutionId: string | null;
  relatedWorkflowId: string | null;
  relatedDocumentId: string | null;
  relatedPaymentId: string | null;
  relatedReminderId: string | null;
  relatedNotificationId: string | null;
  deepLink: string | null;
  pinned: boolean;
  bookmarked: boolean;
}

export interface ActivityQuery {
  workspaceId: string;
  ownerType?: EntityType;
  ownerId?: string;
  categories?: CommunicationCategory[];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  actorMemberId?: string;
}

export type ActivitySourceAdapter = (query: ActivityQuery) => Promise<ActivityEntry[]>;

// ---------------------------------------------------------------------------
// Escalation Engine (Step 10)
// ---------------------------------------------------------------------------

export const ESCALATION_KINDS = [
  "unread_critical_notification",
  "overdue_reminder",
  "late_approval",
  "missed_deadline",
  "pending_response",
  "high_risk_event",
] as const;
export type EscalationKind = (typeof ESCALATION_KINDS)[number];

export interface EscalationCandidate {
  kind: EscalationKind;
  severity: "warning" | "critical";
  message: string;
  recommendation: string;
  ownerType: EntityType | null;
  ownerId: string | null;
  relatedMemberId: string | null;
}

// ---------------------------------------------------------------------------
// Entity Intelligence (Step 15)
// ---------------------------------------------------------------------------

/** The subset of entity types the 360° panel actually supports today — every one of these has at least a name/label resolvable via an existing module getter. Anything outside this list can still get a bare Timeline+Comments panel (every `EntityType` supports those two), just not the fuller Overview/Related-records composition. */
export const ENTITY_INTELLIGENCE_SUPPORTED_TYPES = ["client", "lead", "event", "vendor", "invoice", "proposal"] as const;
export type EntityIntelligenceSupportedType = (typeof ENTITY_INTELLIGENCE_SUPPORTED_TYPES)[number];

export interface EntityIntelligenceSnapshot {
  ownerType: EntityType;
  ownerId: string;
  title: string;
  subtitle: string | null;
  timeline: ActivityEntry[];
  commentCount: number;
  riskScore: number | null;
  riskBand: "excellent" | "good" | "attention" | "critical" | null;
  relationshipScore: number | null;
  upcomingActionCount: number;
  recentChangeCount: number;
  generatedAt: string;
}
