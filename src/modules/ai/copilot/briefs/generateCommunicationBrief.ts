import { getCoreNotificationsService } from "@/core/notifications";
import { mockReminderRepository } from "@/lib/data/core/communication/reminderStore";
import { mockMessageThreadRepository } from "@/lib/data/core/communication/messageThreadStore";
import { clockNow } from "@/core/time/clock";
import type { BriefLine, CommunicationBrief } from "@/modules/ai/copilot/briefs/types";

/**
 * v2.0 Checkpoint 24, Step 14 — Bloom AI Communication Intelligence. Follows
 * `generateExecutiveBrief.ts`/`generateTeamBrief.ts`'s own precedent
 * exactly: fetch every already-computed fact in parallel, then build plain
 * template sentences — no model call, no Skill, nothing non-deterministic.
 * Covers the spec's "Daily Digest"/"Unread Summary"/"Missed Activity"/
 * "Pending Replies"/"Critical Issues" in one brief (a literal separate
 * "Weekly Digest" is the same function called with a 7-day-old
 * `since` boundary — see the optional `since` param).
 */
export async function generateCommunicationBrief(workspaceId: string, memberId: string, firstName: string | null, since?: Date): Promise<CommunicationBrief> {
  const now = clockNow();
  const sinceDate = since ?? new Date(now.getTime() - 24 * 3_600_000);

  const [notifications, reminders, threads] = await Promise.all([
    getCoreNotificationsService().getNotificationsForMember(workspaceId, memberId),
    mockReminderRepository.listRemindersForMember(workspaceId, memberId),
    mockMessageThreadRepository.listThreadsForMember(workspaceId, memberId),
  ]);

  const unreadNotifications = notifications.filter((n) => n.read_at === null && n.archived_at === null);
  const criticalUnread = unreadNotifications.filter((n) => n.priority === "critical");
  const sinceIso = sinceDate.toISOString();
  const recentNotifications = notifications.filter((n) => n.created_at >= sinceIso);

  const overdueReminders = reminders.filter((r) => r.status === "pending" && new Date(r.due_at).getTime() < now.getTime());

  const threadsWithUnread = await Promise.all(
    threads.map(async (thread) => {
      const messages = await mockMessageThreadRepository.listMessages(thread.id);
      const unread = messages.filter((m) => !m.read_by_member_ids.includes(memberId) && m.author_member_id !== memberId);
      return { thread, unread };
    }),
  );
  const pendingReplyThreads = threadsWithUnread.filter((t) => t.unread.length > 0);

  const lines: BriefLine[] = [];

  lines.push({
    id: "unread-summary",
    text: unreadNotifications.length === 0 ? "You have no unread notifications." : `You have ${unreadNotifications.length} unread notification${unreadNotifications.length === 1 ? "" : "s"}.`,
    tone: unreadNotifications.length === 0 ? "success" : "info",
  });

  lines.push({
    id: "missed-activity",
    text: `${recentNotifications.length} notification${recentNotifications.length === 1 ? "" : "s"} came in over the period covered by this digest.`,
    tone: "info",
  });

  if (criticalUnread.length > 0) {
    lines.push({ id: "critical-issues", text: `${criticalUnread.length} critical notification${criticalUnread.length === 1 ? "" : "s"} still need${criticalUnread.length === 1 ? "s" : ""} your attention.`, tone: "warning" });
  }

  if (overdueReminders.length > 0) {
    lines.push({ id: "overdue-reminders", text: `${overdueReminders.length} reminder${overdueReminders.length === 1 ? "" : "s"} overdue.`, tone: "warning" });
  }

  lines.push({
    id: "pending-replies",
    text: pendingReplyThreads.length === 0 ? "No conversations are waiting on a reply from you." : `${pendingReplyThreads.length} conversation${pendingReplyThreads.length === 1 ? "" : "s"} waiting on a reply from you.`,
    tone: pendingReplyThreads.length === 0 ? "success" : "info",
  });

  const summary =
    criticalUnread.length > 0
      ? `${criticalUnread.length} critical item${criticalUnread.length === 1 ? "" : "s"} need${criticalUnread.length === 1 ? "s" : ""} attention.`
      : unreadNotifications.length > 0
        ? `${unreadNotifications.length} unread notification${unreadNotifications.length === 1 ? "" : "s"}, nothing critical.`
        : "You're fully caught up.";

  return {
    greeting: firstName ? `Hi ${firstName},` : "Hi,",
    summary,
    lines,
    criticalIssueCount: criticalUnread.length,
    pendingReplyCount: pendingReplyThreads.length,
    generatedAt: now.toISOString(),
  };
}
