import { mockDailyBriefExecutionsRepository } from "@/lib/data/dailyBrief/mockRepository";
import type { DailyBriefExecutionsRepository } from "@/lib/data/dailyBrief/repository";

export type { DailyBriefExecutionsRepository, RecordDailyBriefExecutionInput } from "@/lib/data/dailyBrief/repository";

/**
 * Deliberately always the mock repository, never routed through
 * `selectRepository()` — same reasoning as `getProposalsRepository()`:
 * no `daily_brief_executions` table exists yet, and the Daily Brief Card is
 * live-mounted unconditionally on `/dashboard`, so a throwing Supabase
 * placeholder would crash it on every real Supabase-mode Workspace, not
 * just a "no history yet" edge case.
 */
export function getDailyBriefExecutionsRepository(): DailyBriefExecutionsRepository {
  return mockDailyBriefExecutionsRepository;
}
