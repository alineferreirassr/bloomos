import type { DailyBriefExecution } from "@/types/dailyBriefExecution";
import type { DataResult } from "@/lib/data/result";

export interface RecordDailyBriefExecutionInput {
  status: "success" | "failure";
  provider: string;
  model: string | null;
  promptVersion: string;
  mock: boolean;
  latencyMs: number;
  generatedAt: string;
}

/**
 * Append-only, same shape as `ProposalsRepository`'s own precedent — no
 * update/delete method exists, matching the Audit Log's "immutable at the
 * type level" rule (`core/audit/repository.ts`), since an execution history
 * record edited after the fact isn't a history record.
 */
export interface DailyBriefExecutionsRepository {
  recordExecution(workspaceId: string, input: RecordDailyBriefExecutionInput): Promise<DataResult<DailyBriefExecution>>;
  getRecentExecutions(workspaceId: string, limit: number): Promise<DailyBriefExecution[]>;
}
