import type { Holiday, HolidayScope } from "@/types/scheduling";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 27, Step 11 — Holiday Registry persistence. Same convention as `appointmentsStore.ts`. */
let holidays: Holiday[] = [];

export function resetHolidaysStore(): void {
  holidays = [];
}

export interface CreateHolidayInput {
  name: string;
  scope: HolidayScope;
  date: string;
  recurring: boolean;
  emergency: boolean;
  time_zone: string;
}

async function listHolidaysForWorkspace(workspaceId: string): Promise<Holiday[]> {
  return holidays.filter((h) => h.workspace_id === workspaceId);
}

async function createHoliday(workspaceId: string, input: CreateHolidayInput): Promise<DataResult<Holiday>> {
  if (!input.name.trim()) return fail("Please fix the highlighted fields.", { name: "Holiday name is required." });

  const timestamp = nowIso();
  const holiday: Holiday = {
    id: generateId("holiday"),
    workspace_id: workspaceId,
    name: input.name.trim(),
    scope: input.scope,
    date: input.date,
    recurring: input.recurring,
    emergency: input.emergency,
    time_zone: input.time_zone,
    created_at: timestamp,
    updated_at: timestamp,
  };
  holidays = [...holidays, holiday];
  return ok(holiday);
}

export interface HolidaysRepository {
  listHolidaysForWorkspace: typeof listHolidaysForWorkspace;
  createHoliday: typeof createHoliday;
}

export const mockHolidaysRepository: HolidaysRepository = {
  listHolidaysForWorkspace,
  createHoliday,
};
