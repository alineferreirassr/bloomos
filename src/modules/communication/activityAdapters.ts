import { getCoreTimelineService } from "@/core/timeline";
import { getTimelineActivityLabel } from "@/core/timeline/activityTypeRegistry";
import { mockActivityRepository } from "@/lib/data/activity/mockRepository";
import { getCoreCommentsService } from "@/core/comments";
import { getCoreNotificationsService } from "@/core/notifications";
import { getAutomationManager } from "@/core/automation/manager";
import { mockReminderRepository } from "@/lib/data/core/communication/reminderStore";
import { mockAnnouncementRepository } from "@/lib/data/core/communication/announcementStore";
import type { ActivityEntry, ActivityQuery, CommunicationCategory } from "@/types/communication";
import { registerActivitySource } from "@/core/communication/activityRegistry";

/**
 * v2.0 Checkpoint 24, Steps 7/7.5 — the concrete `ActivitySourceAdapter`s
 * registered with the ActivityRegistry. Each one normalizes exactly one
 * existing domain's own rows into `ActivityEntry[]` — none of them fetch
 * anything new or duplicate a store; see `docs/communication-timeline.md`
 * for which pre-existing store each adapter reuses. `registerBuiltinActivitySources()`
 * is the one idempotent loader every Communication surface calls before its
 * first read, the same `let registered = false` pattern every other
 * built-in registration loader in this codebase uses.
 */

function categorizeTimelineActivityType(type: string): CommunicationCategory {
  if (type.startsWith("lead_") || type.startsWith("client_") || type.startsWith("lifecycle_") || type.startsWith("vip_") || type.startsWith("contract_")) return "crm";
  if (type.startsWith("invoice_") || type.startsWith("payment_") || type.startsWith("expense_")) return "finance";
  if (type.startsWith("event_") || type.startsWith("checklist_") || type.startsWith("schedule_")) return "operations";
  if (type.startsWith("document_") || type.startsWith("media_")) return "documents";
  return "communication";
}

/** Reuses `core/timeline`'s `TimelineActivity` (89 real, Supabase-backed kinds — CRM/Finance/Documents/Events) — the workspace's own existing generic activity log, not a new one. Per-entity scoped when `ownerType`/`ownerId` are given; otherwise falls back to the workspace-wide `getRecentActivity()` read. */
const timelineActivitySource = async (query: ActivityQuery): Promise<ActivityEntry[]> => {
  const rows = query.ownerType && query.ownerId ? await getCoreTimelineService().getTimelineForOwner(query.workspaceId, query.ownerType, query.ownerId) : await mockActivityRepository.getRecentActivity(500);

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    category: categorizeTimelineActivityType(row.type),
    kind: row.type,
    title: getTimelineActivityLabel(row.type),
    description: row.description,
    actorLabel: row.actor,
    actorMemberId: null,
    occurredAt: row.timestamp,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    relatedAutomationExecutionId: null,
    relatedWorkflowId: null,
    relatedDocumentId: row.owner_type === "document" ? row.owner_id : null,
    relatedPaymentId: row.owner_type === "payment" ? row.owner_id : null,
    relatedReminderId: null,
    relatedNotificationId: null,
    deepLink: null,
    pinned: false,
    bookmarked: false,
  }));
};

/** Reuses `core/comments` — comments only make sense scoped to one owner (there's no meaningful "which entity" for a workspace-wide comment feed row), so this adapter is per-entity only unless the workspace-wide comment read is explicitly wanted. */
const commentsSource = async (query: ActivityQuery): Promise<ActivityEntry[]> => {
  const comments =
    query.ownerType && query.ownerId
      ? await getCoreCommentsService().getCommentsForOwner(query.workspaceId, query.ownerType, query.ownerId)
      : await getCoreCommentsService().getAllCommentsForWorkspace(query.workspaceId);

  return comments.map((comment) => ({
    id: comment.id,
    workspaceId: comment.workspace_id,
    category: "communication" as const,
    kind: "comment_created",
    title: comment.parent_comment_id ? "Replied to a comment" : "Added a comment",
    description: comment.body,
    actorLabel: comment.author,
    actorMemberId: null,
    occurredAt: comment.created_at,
    ownerType: comment.owner_type,
    ownerId: comment.owner_id,
    relatedAutomationExecutionId: null,
    relatedWorkflowId: null,
    relatedDocumentId: null,
    relatedPaymentId: null,
    relatedReminderId: null,
    relatedNotificationId: null,
    deepLink: null,
    pinned: false,
    bookmarked: false,
  }));
};

/** Reuses `core/notifications` — member-recipient notifications only (never Client Portal ones, which have no internal Timeline to appear on). Per-entity scoped via `related_owner_type`/`related_owner_id`. */
const notificationsSource = async (query: ActivityQuery): Promise<ActivityEntry[]> => {
  const all = await getCoreNotificationsService().getMemberNotificationsForWorkspace(query.workspaceId);
  const scoped = query.ownerType && query.ownerId ? all.filter((n) => n.related_owner_type === query.ownerType && n.related_owner_id === query.ownerId) : all;

  return scoped.map((n) => ({
    id: n.id,
    workspaceId: n.workspace_id,
    category: "communication" as const,
    kind: n.kind ?? "notification",
    title: n.title,
    description: n.body,
    actorLabel: "BloomOS",
    actorMemberId: null,
    occurredAt: n.created_at,
    ownerType: n.related_owner_type,
    ownerId: n.related_owner_id,
    relatedAutomationExecutionId: null,
    relatedWorkflowId: null,
    relatedDocumentId: null,
    relatedPaymentId: null,
    relatedReminderId: null,
    relatedNotificationId: n.id,
    deepLink: null,
    pinned: n.pinned_at !== null,
    bookmarked: false,
  }));
};

/** Reuses the Automation Engine's own execution history (`AutomationExecution.triggerFacts`) — no duplicate execution log. Per-entity scoping is best-effort: only trigger types whose facts carry a recognizable id field for the requested `ownerType` are matched. */
const AUTOMATION_OWNER_FACT_KEYS: Partial<Record<string, string>> = {
  invoice: "invoiceId",
  proposal: "proposalId",
  event: "eventId",
  client: "clientId",
  lead: "leadId",
  contract: "contractId",
};

const automationSource = async (query: ActivityQuery): Promise<ActivityEntry[]> => {
  const executions = await getAutomationManager().getRecentExecutions(query.workspaceId, 200);
  const factKey = query.ownerType ? AUTOMATION_OWNER_FACT_KEYS[query.ownerType] : undefined;
  const scoped = query.ownerType && query.ownerId && factKey ? executions.filter((e) => e.triggerFacts[factKey] === query.ownerId) : query.ownerType ? [] : executions;

  return scoped.map((execution) => ({
    id: execution.id,
    workspaceId: execution.workspaceId,
    category: "automation" as const,
    kind: execution.status === "failure" ? "automation_failed" : "automation_executed",
    title: `${execution.automationName} — ${execution.status.replace(/_/g, " ")}`,
    description: execution.actionResults.map((r) => r.message).join("; ") || null,
    actorLabel: "Automation",
    actorMemberId: execution.approvedBy,
    occurredAt: execution.startedAt,
    ownerType: query.ownerType ?? null,
    ownerId: query.ownerId ?? null,
    relatedAutomationExecutionId: execution.id,
    relatedWorkflowId: null,
    relatedDocumentId: null,
    relatedPaymentId: null,
    relatedReminderId: null,
    relatedNotificationId: null,
    deepLink: "/automation",
    pinned: false,
    bookmarked: false,
  }));
};

/** Reuses the new Reminder Engine's own store. */
const reminderSource = async (query: ActivityQuery): Promise<ActivityEntry[]> => {
  const reminders =
    query.ownerType && query.ownerId
      ? await mockReminderRepository.listRemindersForOwner(query.workspaceId, query.ownerType, query.ownerId)
      : await mockReminderRepository.listRemindersForWorkspace(query.workspaceId);

  return reminders.map((reminder) => ({
    id: reminder.id,
    workspaceId: reminder.workspace_id,
    category: "communication" as const,
    kind: "reminder_created",
    title: reminder.title,
    description: reminder.notes,
    actorLabel: "Reminder",
    actorMemberId: reminder.created_by_member_id,
    occurredAt: reminder.created_at,
    ownerType: reminder.owner_type,
    ownerId: reminder.owner_id,
    relatedAutomationExecutionId: null,
    relatedWorkflowId: null,
    relatedDocumentId: null,
    relatedPaymentId: null,
    relatedReminderId: reminder.id,
    relatedNotificationId: null,
    deepLink: null,
    pinned: false,
    bookmarked: false,
  }));
};

/** Announcements are always workspace-scoped — they never appear on a single entity's Timeline, only the workspace-wide Activity Feed and the `"workspace"` owner type's own Timeline. */
const announcementSource = async (query: ActivityQuery): Promise<ActivityEntry[]> => {
  if (query.ownerType && query.ownerType !== "workspace") return [];
  const announcements = await mockAnnouncementRepository.listAllAnnouncements(query.workspaceId);
  return announcements.map((a) => ({
    id: a.id,
    workspaceId: a.workspace_id,
    category: "communication" as const,
    kind: "announcement_published",
    title: a.title,
    description: a.body,
    actorLabel: a.author_name,
    actorMemberId: a.author_member_id,
    occurredAt: a.publish_at,
    ownerType: "workspace" as const,
    ownerId: a.workspace_id,
    relatedAutomationExecutionId: null,
    relatedWorkflowId: null,
    relatedDocumentId: null,
    relatedPaymentId: null,
    relatedReminderId: null,
    relatedNotificationId: null,
    deepLink: "/communications/announcements",
    pinned: a.priority === "critical",
    bookmarked: false,
  }));
};

let registered = false;

/** Idempotent — safe to call from every Communication surface's own data-fetch entry point, the same `let registered = false` guard `registerBuiltinMetrics.ts`/`registerAutomationActions.ts` already use. */
export function registerBuiltinActivitySources(): void {
  if (registered) return;
  registered = true;
  registerActivitySource("timeline-activity", timelineActivitySource);
  registerActivitySource("comments", commentsSource);
  registerActivitySource("notifications", notificationsSource);
  registerActivitySource("automation", automationSource);
  registerActivitySource("reminders", reminderSource);
  registerActivitySource("announcements", announcementSource);
}
