import type { Reminder } from "@/types/communication";

/**
 * v2.0 Checkpoint 24, Step 9 — Reminder Engine. Every function here is pure
 * — given a `Reminder` (and, where relevant, `now`), it answers a question
 * or produces the next state; nothing here reads or writes a store. The
 * module layer (`modules/communication/reminders/reminderActions.ts`) is
 * the one place these get called against real, persisted Reminders.
 */

/** A reminder is "due" once `due_at` has passed (or, if snoozed, once `snoozed_until` has passed) and it hasn't already reached a terminal status. */
export function isReminderDue(reminder: Reminder, now: Date): boolean {
  if (reminder.status === "completed" || reminder.status === "dismissed") return false;
  const effectiveDueAt = reminder.status === "snoozed" && reminder.snoozed_until ? reminder.snoozed_until : reminder.due_at;
  return new Date(effectiveDueAt).getTime() <= now.getTime();
}

export function isReminderOverdue(reminder: Reminder, now: Date, graceMinutes = 0): boolean {
  if (!isReminderDue(reminder, now)) return false;
  const dueAt = reminder.status === "snoozed" && reminder.snoozed_until ? reminder.snoozed_until : reminder.due_at;
  return now.getTime() - new Date(dueAt).getTime() > graceMinutes * 60_000;
}

/**
 * Advances `due_at` by one recurrence step from itself (not from `now`) —
 * a weekly reminder due Monday and completed Wednesday reschedules to the
 * following Monday, never "one week from Wednesday." `"none"` returns
 * `null`: a one-time reminder has no next occurrence.
 */
export function nextOccurrence(reminder: Reminder): string | null {
  if (reminder.recurrence === "none") return null;
  const due = new Date(reminder.due_at);
  switch (reminder.recurrence) {
    case "daily":
      due.setUTCDate(due.getUTCDate() + 1);
      break;
    case "weekly":
      due.setUTCDate(due.getUTCDate() + 7);
      break;
    case "monthly":
      due.setUTCMonth(due.getUTCMonth() + 1);
      break;
  }
  return due.toISOString();
}

/** A snooze always moves a reminder to `"snoozed"` and clears any prior escalation — snoozing is an explicit human decision to wait, not a failure to respond. */
export function applySnooze(reminder: Reminder, until: string): Pick<Reminder, "status" | "snoozed_until" | "escalation_level"> {
  return { status: "snoozed", snoozed_until: until, escalation_level: 0 };
}
