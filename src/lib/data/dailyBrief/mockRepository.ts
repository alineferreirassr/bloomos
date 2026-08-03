import type { DailyBriefExecution } from "@/types/dailyBriefExecution";
import type { DailyBriefExecutionsRepository, RecordDailyBriefExecutionInput } from "@/lib/data/dailyBrief/repository";
import { type DataResult, ok } from "@/lib/data/result";
import { generateId, nowIso, delay } from "@/lib/data/utils";

let executions: DailyBriefExecution[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetDailyBriefExecutionsStore(): void {
  executions = [];
}

async function recordExecution(workspaceId: string, input: RecordDailyBriefExecutionInput): Promise<DataResult<DailyBriefExecution>> {
  await delay(50);
  const execution: DailyBriefExecution = {
    id: generateId("daily-brief-execution"),
    workspace_id: workspaceId,
    status: input.status,
    provider: input.provider,
    model: input.model,
    prompt_version: input.promptVersion,
    mock: input.mock,
    latency_ms: input.latencyMs,
    generated_at: input.generatedAt,
    created_at: nowIso(),
  };
  executions = [...executions, execution];
  return ok(execution);
}

async function getRecentExecutions(workspaceId: string, limit: number): Promise<DailyBriefExecution[]> {
  await delay(100);
  return executions
    .filter((execution) => execution.workspace_id === workspaceId)
    .sort((a, b) => b.generated_at.localeCompare(a.generated_at))
    .slice(0, limit);
}

export const mockDailyBriefExecutionsRepository: DailyBriefExecutionsRepository = {
  recordExecution,
  getRecentExecutions,
};
