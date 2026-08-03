import type { CalendarWindow, CalendarWindowType } from "@/types/scheduling";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 27 — Calendar Window persistence, covering both Availability Windows and Blackout Periods (Step 1) — see `types/scheduling.ts`'s `CalendarWindow` doc comment. Same convention as `appointmentsStore.ts`. */
let windows: CalendarWindow[] = [];

export function resetCalendarWindowsStore(): void {
  windows = [];
}

export interface CreateCalendarWindowInput {
  /** `null` means workspace-wide (a true blackout period). */
  calendar_id: string | null;
  type: CalendarWindowType;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

async function listWindowsForWorkspace(workspaceId: string): Promise<CalendarWindow[]> {
  return windows.filter((w) => w.workspace_id === workspaceId);
}

/** Includes workspace-wide windows (`calendar_id: null`) alongside this calendar's own — a blackout period always applies regardless of which calendar is being read. */
async function listWindowsForCalendar(workspaceId: string, calendarId: string): Promise<CalendarWindow[]> {
  return windows.filter((w) => w.workspace_id === workspaceId && (w.calendar_id === calendarId || w.calendar_id === null));
}

async function createWindow(workspaceId: string, createdBy: string, input: CreateCalendarWindowInput): Promise<DataResult<CalendarWindow>> {
  if (input.ends_at <= input.starts_at) return fail("Please fix the highlighted fields.", { ends_at: "End time must be after the start time." });

  const timestamp = nowIso();
  const window: CalendarWindow = {
    id: generateId("calendar_window"),
    workspace_id: workspaceId,
    calendar_id: input.calendar_id,
    type: input.type,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    reason: input.reason,
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
  };
  windows = [...windows, window];
  return ok(window);
}

export interface CalendarWindowsRepository {
  listWindowsForWorkspace: typeof listWindowsForWorkspace;
  listWindowsForCalendar: typeof listWindowsForCalendar;
  createWindow: typeof createWindow;
}

export const mockCalendarWindowsRepository: CalendarWindowsRepository = {
  listWindowsForWorkspace,
  listWindowsForCalendar,
  createWindow,
};
