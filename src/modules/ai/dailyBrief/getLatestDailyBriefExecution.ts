"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDailyBriefExecutionsRepository } from "@/lib/data/dailyBrief";
import type { DailyBriefExecution } from "@/types/dailyBriefExecution";

const GENERIC_ACCESS_ERROR = "The Daily Operations Brief isn't available. You may not have access to it.";

export type GetLatestDailyBriefExecutionResult = { success: true; data: DailyBriefExecution | null } | { success: false; error: string };

/**
 * Backs the Dashboard card's "View Previous" action — reads only the
 * persisted execution *metadata* (timestamp/provider/latency/prompt
 * version/status), never the brief's own content, since that was never
 * persisted in the first place (see `types/dailyBriefExecution.ts`'s doc
 * comment). "View Previous" is honest about that: it surfaces "when did
 * this last run and how", not a re-display of what it said.
 */
export async function getLatestDailyBriefExecution(): Promise<GetLatestDailyBriefExecutionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const executions = await getDailyBriefExecutionsRepository().getRecentExecutions(session.workspace.id, 1);
  return { success: true, data: executions[0] ?? null };
}
