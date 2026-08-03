import type { Reminder, ReminderRecurrence, ReminderPriority, ReminderCategory } from "@/types/communication";
import type { EntityType } from "@/core/enums/entityType";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso, delay } from "@/lib/data/utils";

/** v2.0 Checkpoint 24, Step 9 — Reminder Engine's own persistence. Same `let` array + reset convention as every other mock store in this codebase. */
let reminders: Reminder[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetReminderStore(): void {
  reminders = [];
}

export interface CreateReminderInput {
  assignedToMemberId: string;
  title: string;
  notes?: string | null;
  dueAt: string;
  recurrence?: ReminderRecurrence;
  priority?: ReminderPriority;
  category?: ReminderCategory;
  ownerType?: EntityType | null;
  ownerId?: string | null;
}

async function listRemindersForWorkspace(workspaceId: string): Promise<Reminder[]> {
  await delay(100);
  return reminders.filter((r) => r.workspace_id === workspaceId).sort((a, b) => a.due_at.localeCompare(b.due_at));
}

async function listRemindersForMember(workspaceId: string, memberId: string): Promise<Reminder[]> {
  await delay(100);
  return reminders
    .filter((r) => r.workspace_id === workspaceId && r.assigned_to_member_id === memberId)
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
}

async function listRemindersForOwner(workspaceId: string, ownerType: EntityType, ownerId: string): Promise<Reminder[]> {
  await delay(100);
  return reminders
    .filter((r) => r.workspace_id === workspaceId && r.owner_type === ownerType && r.owner_id === ownerId)
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
}

async function createReminder(workspaceId: string, createdByMemberId: string, input: CreateReminderInput): Promise<DataResult<Reminder>> {
  const title = input.title.trim();
  if (title.length === 0) {
    return fail("Please fix the highlighted fields.", { title: "Title is required" });
  }
  const now = nowIso();
  const reminder: Reminder = {
    id: generateId("reminder"),
    workspace_id: workspaceId,
    created_by_member_id: createdByMemberId,
    assigned_to_member_id: input.assignedToMemberId,
    title,
    notes: input.notes ?? null,
    due_at: input.dueAt,
    recurrence: input.recurrence ?? "none",
    priority: input.priority ?? "normal",
    category: input.category ?? "task",
    status: "pending",
    snoozed_until: null,
    escalation_level: 0,
    owner_type: input.ownerType ?? null,
    owner_id: input.ownerId ?? null,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };
  reminders = [...reminders, reminder];
  return ok(reminder);
}

async function updateReminder(id: string, patch: Partial<Pick<Reminder, "status" | "snoozed_until" | "escalation_level" | "due_at" | "completed_at">>): Promise<DataResult<Reminder>> {
  const existing = reminders.find((r) => r.id === id);
  if (!existing) return fail("Reminder not found.");
  const updated: Reminder = { ...existing, ...patch, updated_at: nowIso() };
  reminders = reminders.map((r) => (r.id === id ? updated : r));
  return ok(updated);
}

async function deleteReminder(id: string): Promise<DataResult<Reminder>> {
  const existing = reminders.find((r) => r.id === id);
  if (!existing) return fail("Reminder not found.");
  reminders = reminders.filter((r) => r.id !== id);
  return ok(existing);
}

export const mockReminderRepository = {
  listRemindersForWorkspace,
  listRemindersForMember,
  listRemindersForOwner,
  createReminder,
  updateReminder,
  deleteReminder,
};
