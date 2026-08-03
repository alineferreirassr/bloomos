import type { Calendar, CalendarContextType, CalendarStatus } from "@/types/scheduling";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 27 — Calendar Registry persistence. Same `let` array + `resetXStore()` convention every mock store in this codebase uses. Mock-only — no Supabase table exists yet. */
let calendars: Calendar[] = [];

export function resetCalendarsStore(): void {
  calendars = [];
}

export interface CreateCalendarInput {
  name: string;
  description: string | null;
  context_type: CalendarContextType;
  context: KnowledgeNodeRef | null;
  time_zone: string;
}

async function listCalendarsForWorkspace(workspaceId: string, includeArchived = false): Promise<Calendar[]> {
  return calendars.filter((c) => c.workspace_id === workspaceId && (includeArchived || c.archived_at === null));
}

async function getCalendarById(id: string): Promise<Calendar | null> {
  return calendars.find((c) => c.id === id) ?? null;
}

async function createCalendar(workspaceId: string, createdBy: string, input: CreateCalendarInput): Promise<DataResult<Calendar>> {
  if (!input.name.trim()) return fail("Please fix the highlighted fields.", { name: "Calendar name is required." });

  const timestamp = nowIso();
  const calendar: Calendar = {
    id: generateId("calendar"),
    workspace_id: workspaceId,
    name: input.name.trim(),
    description: input.description,
    context_type: input.context_type,
    context: input.context,
    time_zone: input.time_zone,
    status: "active",
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  calendars = [...calendars, calendar];
  return ok(calendar);
}

async function setCalendarStatus(id: string, workspaceId: string, status: CalendarStatus): Promise<DataResult<Calendar>> {
  const existing = calendars.find((c) => c.id === id && c.workspace_id === workspaceId);
  if (!existing) return fail("This calendar could not be found.");

  const timestamp = nowIso();
  const updated: Calendar = { ...existing, status, archived_at: status === "archived" ? timestamp : null, updated_at: timestamp };
  calendars = calendars.map((c) => (c.id === id ? updated : c));
  return ok(updated);
}

export interface CalendarsRepository {
  listCalendarsForWorkspace: typeof listCalendarsForWorkspace;
  getCalendarById: typeof getCalendarById;
  createCalendar: typeof createCalendar;
  setCalendarStatus: typeof setCalendarStatus;
}

export const mockCalendarsRepository: CalendarsRepository = {
  listCalendarsForWorkspace,
  getCalendarById,
  createCalendar,
  setCalendarStatus,
};
