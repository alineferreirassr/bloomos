import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/automation/manager", () => ({
  getAutomationManager: vi.fn(),
}));
vi.mock("@/lib/data/core/workflow/simulationStore", () => ({
  listWorkflowSimulationRuns: vi.fn(),
}));

import { getAutomationManager } from "@/core/automation/manager";
import { listWorkflowSimulationRuns } from "@/lib/data/core/workflow/simulationStore";
import { getMetric } from "@/core/analytics/metricRegistry";
import { registerWorkflowMetrics } from "@/modules/analytics/metrics/workflowMetrics";
import type { MetricComputeContext } from "@/types/analytics";

registerWorkflowMetrics();

const WINDOW = { start: "2026-07-01T00:00:00.000Z", end: "2026-07-15T00:00:00.000Z" };
const PREVIOUS_WINDOW = { start: "2026-06-17T00:00:00.000Z", end: "2026-07-01T00:00:00.000Z" };
const CONTEXT: MetricComputeContext = { workspaceId: "ws_1", window: WINDOW, previousWindow: PREVIOUS_WINDOW, permissions: [], role: "owner" };

const getRecentExecutions = vi.fn();

function execution(overrides: Record<string, unknown> = {}) {
  return { id: "ex1", startedAt: "2026-07-05T00:00:00.000Z", status: "success", ...overrides };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("workflow.executions", () => {
  it("counts executions started within the window", async () => {
    vi.mocked(getAutomationManager).mockReturnValue({ getRecentExecutions } as never);
    getRecentExecutions.mockResolvedValue([execution(), execution({ startedAt: "2026-06-20T00:00:00.000Z" })]);
    const result = await getMetric("workflow.executions")!.compute(CONTEXT);
    expect(result.value).toBe(1);
  });
});

describe("workflow.failureRate", () => {
  it("counts both failure and partial_failure toward the failed share", async () => {
    vi.mocked(getAutomationManager).mockReturnValue({ getRecentExecutions } as never);
    getRecentExecutions.mockResolvedValue([
      execution({ status: "success" }),
      execution({ status: "failure" }),
      execution({ status: "partial_failure" }),
      execution({ status: "success" }),
    ]);
    const result = await getMetric("workflow.failureRate")!.compute(CONTEXT);
    expect(result.value).toBe(50);
  });

  it("returns 0 rather than dividing by zero when nothing executed in the window", async () => {
    vi.mocked(getAutomationManager).mockReturnValue({ getRecentExecutions } as never);
    getRecentExecutions.mockResolvedValue([]);
    const result = await getMetric("workflow.failureRate")!.compute(CONTEXT);
    expect(result.value).toBe(0);
  });
});

describe("workflow.simulationUsage", () => {
  it("counts real, persisted Simulation runs within the window", async () => {
    vi.mocked(listWorkflowSimulationRuns).mockReturnValue([
      { id: "s1", workspace_id: "ws_1", workflow_id: "wf1", path_count: 2, issue_count: 0, occurred_at: "2026-07-05T00:00:00.000Z" },
    ] as never);
    const result = await getMetric("workflow.simulationUsage")!.compute(CONTEXT);
    expect(result.value).toBe(1);
  });
});
