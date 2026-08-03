import type { RecurrenceRule, RecurrenceFrequency, NthWeekday } from "@/types/scheduling";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 27, Step 9 — Recurrence Rule persistence. Same convention as `appointmentsStore.ts`. */
let rules: RecurrenceRule[] = [];

export function resetRecurrenceRulesStore(): void {
  rules = [];
}

export interface CreateRecurrenceRuleInput {
  frequency: RecurrenceFrequency;
  interval: number;
  days_of_week: number[] | null;
  day_of_month: number | null;
  nth_weekday: NthWeekday | null;
  end_date: string | null;
  occurrence_count: number | null;
  exception_dates: string[];
}

async function getRuleById(id: string): Promise<RecurrenceRule | null> {
  return rules.find((r) => r.id === id) ?? null;
}

async function createRule(workspaceId: string, input: CreateRecurrenceRuleInput): Promise<DataResult<RecurrenceRule>> {
  if (input.interval < 1) return fail("Please fix the highlighted fields.", { interval: "Interval must be at least 1." });
  if (input.day_of_month !== null && input.nth_weekday !== null) return fail("Please fix the highlighted fields.", { day_of_month: "A rule can't set both a fixed day-of-month and an nth-weekday pattern." });

  const timestamp = nowIso();
  const rule: RecurrenceRule = {
    id: generateId("recurrence_rule"),
    workspace_id: workspaceId,
    frequency: input.frequency,
    interval: input.interval,
    days_of_week: input.days_of_week,
    day_of_month: input.day_of_month,
    nth_weekday: input.nth_weekday,
    end_date: input.end_date,
    occurrence_count: input.occurrence_count,
    exception_dates: input.exception_dates,
    created_at: timestamp,
    updated_at: timestamp,
  };
  rules = [...rules, rule];
  return ok(rule);
}

export interface RecurrenceRulesRepository {
  getRuleById: typeof getRuleById;
  createRule: typeof createRule;
}

export const mockRecurrenceRulesRepository: RecurrenceRulesRepository = {
  getRuleById,
  createRule,
};
