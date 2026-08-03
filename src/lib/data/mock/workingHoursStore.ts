import type { WorkingHoursRule, WorkingHoursKind } from "@/types/scheduling";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 27, Step 3 — Working Hours persistence. Same convention as `appointmentsStore.ts`. */
let rules: WorkingHoursRule[] = [];

export function resetWorkingHoursStore(): void {
  rules = [];
}

export interface CreateWorkingHoursRuleInput {
  calendar_id: string;
  kind: WorkingHoursKind;
  day_of_week: number | null;
  specific_date: string | null;
  starts_time: string;
  ends_time: string;
  time_zone: string;
  is_closed: boolean;
}

async function listRulesForCalendar(calendarId: string): Promise<WorkingHoursRule[]> {
  return rules.filter((r) => r.calendar_id === calendarId);
}

async function createRule(workspaceId: string, createdBy: string, input: CreateWorkingHoursRuleInput): Promise<DataResult<WorkingHoursRule>> {
  if (!input.is_closed && input.ends_time <= input.starts_time) return fail("Please fix the highlighted fields.", { ends_time: "End time must be after the start time." });

  const timestamp = nowIso();
  const rule: WorkingHoursRule = {
    id: generateId("working_hours_rule"),
    workspace_id: workspaceId,
    calendar_id: input.calendar_id,
    kind: input.kind,
    day_of_week: input.day_of_week,
    specific_date: input.specific_date,
    starts_time: input.starts_time,
    ends_time: input.ends_time,
    time_zone: input.time_zone,
    is_closed: input.is_closed,
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
  };
  rules = [...rules, rule];
  return ok(rule);
}

export interface WorkingHoursRepository {
  listRulesForCalendar: typeof listRulesForCalendar;
  createRule: typeof createRule;
}

export const mockWorkingHoursRepository: WorkingHoursRepository = {
  listRulesForCalendar,
  createRule,
};
