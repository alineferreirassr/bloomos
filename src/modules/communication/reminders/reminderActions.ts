"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { mockReminderRepository, type CreateReminderInput } from "@/lib/data/core/communication/reminderStore";
import { isReminderDue, isReminderOverdue, nextOccurrence, applySnooze } from "@/core/communication/reminderEngine";
import { buildNotificationInput } from "@/core/communication/notificationEngine";
import { getCoreNotificationsService } from "@/core/notifications";
import { clockNow } from "@/core/time/clock";
import type { Reminder } from "@/types/communication";
import type { DataResult } from "@/lib/data/result";

const GENERIC_ACCESS_ERROR = "Reminders aren't available. You may not have access to them.";

export async function listMyRemindersAction(): Promise<DataResult<Reminder[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const reminders = await mockReminderRepository.listRemindersForMember(session.workspace.id, session.membership.id);
  return { success: true, data: reminders };
}

/** `input.assignedToMemberId` defaults to the current member when omitted/blank — the common case ("remind me") shouldn't require the UI to know its own session's member id. */
export async function createReminderAction(input: CreateReminderInput): Promise<DataResult<Reminder>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const assignedToMemberId = input.assignedToMemberId.trim().length > 0 ? input.assignedToMemberId : session.membership.id;
  return mockReminderRepository.createReminder(session.workspace.id, session.membership.id, { ...input, assignedToMemberId });
}

async function requireOwnedReminder(id: string, workspaceId: string, memberId: string): Promise<Reminder | null> {
  const reminders = await mockReminderRepository.listRemindersForMember(workspaceId, memberId);
  return reminders.find((r) => r.id === id) ?? null;
}

export async function completeReminderAction(id: string): Promise<DataResult<Reminder>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedReminder(id, session.workspace.id, session.membership.id))) return { success: false, error: "Reminder not found." };

  const result = await mockReminderRepository.updateReminder(id, { status: "completed", completed_at: clockNow().toISOString() });
  if (!result.success) return result;

  // A recurring reminder immediately reschedules itself for its next occurrence, rather than requiring the member to re-create it.
  const next = nextOccurrence(result.data);
  if (next) {
    await mockReminderRepository.updateReminder(id, { status: "pending", due_at: next, completed_at: null });
  }
  return result;
}

export async function dismissReminderAction(id: string): Promise<DataResult<Reminder>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedReminder(id, session.workspace.id, session.membership.id))) return { success: false, error: "Reminder not found." };
  return mockReminderRepository.updateReminder(id, { status: "dismissed" });
}

export async function snoozeReminderAction(id: string, until: string): Promise<DataResult<Reminder>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const existing = await requireOwnedReminder(id, session.workspace.id, session.membership.id);
  if (!existing) return { success: false, error: "Reminder not found." };
  return mockReminderRepository.updateReminder(id, applySnooze(existing, until));
}

export async function deleteReminderAction(id: string): Promise<DataResult<Reminder>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedReminder(id, session.workspace.id, session.membership.id))) return { success: false, error: "Reminder not found." };
  return mockReminderRepository.deleteReminder(id);
}

/**
 * v2.0 Checkpoint 24, Step 9/2 — the real "Reminder Due" notification path.
 * Called on-read (the Notification Center's own data fetch, and the
 * Bloom AI Communication Brief) rather than a background sweep — this
 * codebase has no scheduled-jobs infrastructure by deliberate precedent
 * (see the Automation Engine's own non-goals). Every due reminder that
 * hasn't already produced a notification for its *current* `due_at` gets
 * exactly one — re-running this against the same due reminder is a no-op
 * because `escalation_level` is bumped past 0 the first time.
 */
export async function notifyDueRemindersForCurrentMember(): Promise<number> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return 0;

  const reminders = await mockReminderRepository.listRemindersForMember(session.workspace.id, session.membership.id);
  const now = clockNow();
  let notified = 0;

  for (const reminder of reminders) {
    if (reminder.escalation_level > 0) continue;
    if (!isReminderDue(reminder, now)) continue;

    await getCoreNotificationsService().createInAppNotification(
      session.workspace.id,
      buildNotificationInput({
        kind: "reminder_due",
        recipientMemberId: reminder.assigned_to_member_id,
        title: `Reminder: ${reminder.title}`,
        body: reminder.notes ?? "This reminder is due.",
        relatedOwnerType: reminder.owner_type,
        relatedOwnerId: reminder.owner_id,
        priorityOverride: isReminderOverdue(reminder, now, 24) ? "critical" : undefined,
      }),
    );
    await mockReminderRepository.updateReminder(reminder.id, { escalation_level: 1 });
    notified += 1;
  }

  return notified;
}
