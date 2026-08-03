import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/proposals", () => ({
  getProposalsRepository: vi.fn(),
}));
vi.mock("@/lib/data/dailyBrief", () => ({
  getDailyBriefExecutionsRepository: vi.fn(),
}));

import { getProposalsRepository } from "@/lib/data/proposals";
import { getDailyBriefExecutionsRepository } from "@/lib/data/dailyBrief";
import { getMetric } from "@/core/analytics/metricRegistry";
import { registerAiMetrics } from "@/modules/analytics/metrics/aiMetrics";
import type { MetricComputeContext } from "@/types/analytics";

registerAiMetrics();

const WINDOW = { start: "2026-07-01T00:00:00.000Z", end: "2026-07-15T00:00:00.000Z" };
const PREVIOUS_WINDOW = { start: "2026-06-17T00:00:00.000Z", end: "2026-07-01T00:00:00.000Z" };
const CONTEXT: MetricComputeContext = { workspaceId: "ws_1", window: WINDOW, previousWindow: PREVIOUS_WINDOW, permissions: [], role: "owner" };

const getRecentProposals = vi.fn();
const getRecentExecutions = vi.fn();

afterEach(() => {
  vi.clearAllMocks();
});

describe("ai.usage", () => {
  it("sums Proposal drafts and Daily Brief runs generated within the window, never double-counted", async () => {
    vi.mocked(getProposalsRepository).mockReturnValue({ getRecentProposals } as never);
    vi.mocked(getDailyBriefExecutionsRepository).mockReturnValue({ getRecentExecutions } as never);
    getRecentProposals.mockResolvedValue([{ id: "p1", created_at: "2026-07-05T00:00:00.000Z" }]);
    getRecentExecutions.mockResolvedValue([{ id: "b1", created_at: "2026-07-06T00:00:00.000Z", status: "success" }]);

    const result = await getMetric("ai.usage")!.compute(CONTEXT);
    expect(result.value).toBe(2);
  });
});

describe("ai.dailyBriefSuccessRate", () => {
  it("computes the succeeded share of Daily Brief runs within the window", async () => {
    vi.mocked(getDailyBriefExecutionsRepository).mockReturnValue({ getRecentExecutions } as never);
    getRecentExecutions.mockResolvedValue([
      { id: "b1", created_at: "2026-07-05T00:00:00.000Z", status: "success" },
      { id: "b2", created_at: "2026-07-06T00:00:00.000Z", status: "failure" },
    ]);
    const result = await getMetric("ai.dailyBriefSuccessRate")!.compute(CONTEXT);
    expect(result.value).toBe(50);
  });
});
