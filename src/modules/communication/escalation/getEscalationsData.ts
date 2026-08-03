"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCoreNotificationsService } from "@/core/notifications";
import { mockReminderRepository } from "@/lib/data/core/communication/reminderStore";
import { getAutomationManager } from "@/core/automation/manager";
import { getOperationsDashboardData } from "@/modules/operations/operationsDashboardData";
import { detectEscalations } from "@/core/communication/escalationEngine";
import { buildNotificationInput } from "@/core/communication/notificationEngine";
import { clockNow } from "@/core/time/clock";
import type { EscalationCandidate } from "@/types/communication";

const GENERIC_ACCESS_ERROR = "Escalations aren't available. You may not have access to them.";
const MS_PER_HOUR = 3_600_000;

function hoursSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / MS_PER_HOUR;
}

/**
 * v2.0 Checkpoint 24, Step 10 — Escalation Engine's own data assembly.
 * Gathers pre-aggregated facts from every existing source the spec names
 * (unread critical notifications, overdue Reminders, late Automation
 * approvals, high-risk Events via Checkpoint 21's own per-event health
 * score) and hands them to the pure `detectEscalations()`. On read (not a
 * background sweep — see `reminderActions.ts`'s own doc comment for why),
 * every returned candidate also gets one real, `"escalation"`-kind,
 * critical-priority Notification sent to the relevant member, so an
 * escalation is never a silent list nobody is told about.
 */
export async function getEscalationsData(): Promise<{ success: true; data: EscalationCandidate[] } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const now = clockNow();
  const [memberNotifications, reminders, pendingApprovals, operationsData] = await Promise.all([
    getCoreNotificationsService().getMemberNotificationsForWorkspace(session.workspace.id),
    mockReminderRepository.listRemindersForWorkspace(session.workspace.id),
    getAutomationManager().getPendingApprovals(session.workspace.id),
    getOperationsDashboardData(),
  ]);

  const candidates = detectEscalations({
    unreadCriticalNotifications: memberNotifications
      .filter((n) => n.priority === "critical" && n.read_at === null && n.archived_at === null && n.recipient_member_id !== null)
      .map((n) => ({ id: n.id, recipientMemberId: n.recipient_member_id as string, ageHours: hoursSince(n.created_at, now) })),
    overdueReminders: reminders
      .filter((r) => r.status === "pending" && new Date(r.due_at).getTime() < now.getTime())
      .map((r) => ({ id: r.id, assignedToMemberId: r.assigned_to_member_id, overdueHours: hoursSince(r.due_at, now) })),
    lateApprovals: pendingApprovals.map((execution) => ({ executionId: execution.id, automationName: execution.automationName, ageHours: hoursSince(execution.startedAt, now) })),
    missedDeadlines: [],
    pendingResponses: [],
    highRiskEvents: operationsData.eventHealthScores.map((entry) => ({ eventId: entry.event.id, eventName: entry.event.title, healthScore: entry.score })),
  });

  await Promise.all(
    candidates
      .filter((c) => c.relatedMemberId)
      .map((c) =>
        getCoreNotificationsService().createInAppNotification(
          session.workspace.id,
          buildNotificationInput({
            kind: "escalation",
            recipientMemberId: c.relatedMemberId as string,
            title: c.message,
            body: c.recommendation,
            relatedOwnerType: c.ownerType,
            relatedOwnerId: c.ownerId,
          }),
        ),
      ),
  );

  return { success: true, data: candidates };
}
