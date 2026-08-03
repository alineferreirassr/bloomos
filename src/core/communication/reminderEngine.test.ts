import { describe, expect, it } from "vitest";
import { isReminderDue, isReminderOverdue, nextOccurrence, applySnooze } from "@/core/communication/reminderEngine";
import type { Reminder } from "@/types/communication";

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: "reminder_1",
    workspace_id: "ws_1",
    created_by_member_id: "member_1",
    assigned_to_member_id: "member_1",
    title: "Follow up",
    notes: null,
    due_at: "2026-07-15T12:00:00.000Z",
    recurrence: "none",
    priority: "normal",
    category: "task",
    status: "pending",
    snoozed_until: null,
    escalation_level: 0,
    owner_type: null,
    owner_id: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

describe("isReminderDue", () => {
  it("is due once due_at has passed", () => {
    const reminder = makeReminder({ due_at: "2026-07-15T12:00:00.000Z" });
    expect(isReminderDue(reminder, new Date("2026-07-15T13:00:00.000Z"))).toBe(true);
  });

  it("is not due before due_at", () => {
    const reminder = makeReminder({ due_at: "2026-07-15T12:00:00.000Z" });
    expect(isReminderDue(reminder, new Date("2026-07-15T11:00:00.000Z"))).toBe(false);
  });

  it("uses snoozed_until instead of due_at once snoozed", () => {
    const reminder = makeReminder({ due_at: "2026-07-15T12:00:00.000Z", status: "snoozed", snoozed_until: "2026-07-20T12:00:00.000Z" });
    expect(isReminderDue(reminder, new Date("2026-07-16T00:00:00.000Z"))).toBe(false);
    expect(isReminderDue(reminder, new Date("2026-07-21T00:00:00.000Z"))).toBe(true);
  });

  it("is never due once completed or dismissed", () => {
    expect(isReminderDue(makeReminder({ status: "completed" }), new Date("2026-08-01T00:00:00.000Z"))).toBe(false);
    expect(isReminderDue(makeReminder({ status: "dismissed" }), new Date("2026-08-01T00:00:00.000Z"))).toBe(false);
  });
});

describe("isReminderOverdue", () => {
  it("is overdue only past the grace window", () => {
    const reminder = makeReminder({ due_at: "2026-07-15T12:00:00.000Z" });
    expect(isReminderOverdue(reminder, new Date("2026-07-15T12:30:00.000Z"), 60)).toBe(false);
    expect(isReminderOverdue(reminder, new Date("2026-07-15T14:00:00.000Z"), 60)).toBe(true);
  });
});

describe("nextOccurrence", () => {
  it("returns null for a one-time reminder", () => {
    expect(nextOccurrence(makeReminder({ recurrence: "none" }))).toBeNull();
  });

  it("advances daily/weekly/monthly from due_at itself, not from now", () => {
    expect(nextOccurrence(makeReminder({ recurrence: "daily", due_at: "2026-07-15T12:00:00.000Z" }))).toBe("2026-07-16T12:00:00.000Z");
    expect(nextOccurrence(makeReminder({ recurrence: "weekly", due_at: "2026-07-15T12:00:00.000Z" }))).toBe("2026-07-22T12:00:00.000Z");
    expect(nextOccurrence(makeReminder({ recurrence: "monthly", due_at: "2026-07-15T12:00:00.000Z" }))).toBe("2026-08-15T12:00:00.000Z");
  });
});

describe("applySnooze", () => {
  it("sets status to snoozed, records snoozed_until, and clears escalation", () => {
    const patch = applySnooze(makeReminder({ escalation_level: 2 }), "2026-07-20T00:00:00.000Z");
    expect(patch).toEqual({ status: "snoozed", snoozed_until: "2026-07-20T00:00:00.000Z", escalation_level: 0 });
  });
});
