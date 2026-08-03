import type { DailyBriefExecutionsRepository } from "@/lib/data/dailyBrief/repository";

/**
 * No `daily_brief_executions` table or migration exists yet (mock-only this
 * phase) — every method throws rather than faking a query against a table
 * that doesn't exist, matching the same "throw, don't pretend" placeholder
 * `lib/data/proposals/supabaseRepository.ts` already ships.
 */
function notMigrated(): never {
  throw new Error("Daily Brief execution history has not been migrated to Supabase yet — this phase is mock-only.");
}

export const supabaseDailyBriefExecutionsRepository: DailyBriefExecutionsRepository = {
  recordExecution: () => notMigrated(),
  getRecentExecutions: () => notMigrated(),
};
