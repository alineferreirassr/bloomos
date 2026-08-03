import { afterEach, describe, expect, it } from "vitest";
import { mockDailyBriefExecutionsRepository, resetDailyBriefExecutionsStore } from "@/lib/data/dailyBrief/mockRepository";
import type { RecordDailyBriefExecutionInput } from "@/lib/data/dailyBrief/repository";

function input(overrides: Partial<RecordDailyBriefExecutionInput> = {}): RecordDailyBriefExecutionInput {
  return {
    status: "success",
    provider: "mock",
    model: "bloomos-daily-mock-v2",
    promptVersion: "daily-operations-brief-v2",
    mock: true,
    latencyMs: 42,
    generatedAt: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => resetDailyBriefExecutionsStore());

describe("mockDailyBriefExecutionsRepository", () => {
  it("records an execution and returns it", async () => {
    const result = await mockDailyBriefExecutionsRepository.recordExecution("ws_1", input());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ workspace_id: "ws_1", status: "success", provider: "mock", latency_ms: 42 });
    }
  });

  it("lists recent executions for a Workspace, newest first", async () => {
    await mockDailyBriefExecutionsRepository.recordExecution("ws_1", input({ generatedAt: "2026-07-24T00:00:00.000Z" }));
    await mockDailyBriefExecutionsRepository.recordExecution("ws_1", input({ generatedAt: "2026-07-25T00:00:00.000Z" }));

    const executions = await mockDailyBriefExecutionsRepository.getRecentExecutions("ws_1", 5);
    expect(executions.map((e) => e.generated_at)).toEqual(["2026-07-25T00:00:00.000Z", "2026-07-24T00:00:00.000Z"]);
  });

  it("never returns another Workspace's execution history", async () => {
    await mockDailyBriefExecutionsRepository.recordExecution("ws_1", input());
    await mockDailyBriefExecutionsRepository.recordExecution("ws_other", input());

    const executions = await mockDailyBriefExecutionsRepository.getRecentExecutions("ws_1", 5);
    expect(executions).toHaveLength(1);
    expect(executions[0].workspace_id).toBe("ws_1");
  });

  it("caps results at the requested limit", async () => {
    for (let i = 0; i < 3; i++) {
      await mockDailyBriefExecutionsRepository.recordExecution("ws_1", input({ generatedAt: `2026-07-2${i}T00:00:00.000Z` }));
    }
    const executions = await mockDailyBriefExecutionsRepository.getRecentExecutions("ws_1", 2);
    expect(executions).toHaveLength(2);
  });

  it("returns an empty array for a Workspace with no history yet", async () => {
    expect(await mockDailyBriefExecutionsRepository.getRecentExecutions("ws_empty", 5)).toEqual([]);
  });

  it("records both a success and a failure status", async () => {
    const result = await mockDailyBriefExecutionsRepository.recordExecution("ws_1", input({ status: "failure", provider: "n/a", model: null }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("failure");
  });
});
