import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/featureFlags", () => ({
  evaluateFeatureFlag: vi.fn(),
}));

import { listVisibleMetrics } from "@/core/analytics/discovery";
import { registerMetric, resetMetricRegistry } from "@/core/analytics/metricRegistry";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import type { MetricDefinition } from "@/types/analytics";

function makeMetric(overrides: Partial<MetricDefinition> = {}): MetricDefinition {
  return {
    id: "test.metric",
    name: "Test Metric",
    description: "A test metric.",
    category: "revenue",
    unit: "count",
    icon: "DollarSign",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    refreshPolicy: "realtime",
    compute: async () => ({ value: 1, previousValue: null, changePercent: null, trend: "flat" as const, series: [] }),
    ...overrides,
  };
}

afterEach(() => {
  resetMetricRegistry();
  vi.clearAllMocks();
});

describe("listVisibleMetrics", () => {
  it("filters out a metric requiring a permission the caller doesn't hold", async () => {
    registerMetric(makeMetric({ id: "gated", requiredPermissions: ["finance.view"] }));
    const result = await listVisibleMetrics({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(result).toHaveLength(0);
  });

  it("includes a metric when every required permission is held", async () => {
    registerMetric(makeMetric({ id: "gated", requiredPermissions: ["finance.view", "clients.view"] }));
    const result = await listVisibleMetrics({ workspaceId: "ws_1", permissions: ["finance.view", "clients.view"], role: "owner" });
    expect(result.map((m) => m.id)).toEqual(["gated"]);
  });

  it("filters out a metric whose minimumRole the caller's role doesn't meet", async () => {
    registerMetric(makeMetric({ id: "manager-only", minimumRole: "manager" }));
    const staffResult = await listVisibleMetrics({ workspaceId: "ws_1", permissions: [], role: "staff" });
    const managerResult = await listVisibleMetrics({ workspaceId: "ws_1", permissions: [], role: "manager" });
    expect(staffResult).toHaveLength(0);
    expect(managerResult.map((m) => m.id)).toEqual(["manager-only"]);
  });

  it("treats a null role as never meeting any minimumRole requirement", async () => {
    registerMetric(makeMetric({ id: "role-gated", minimumRole: "staff" }));
    const result = await listVisibleMetrics({ workspaceId: "ws_1", permissions: [], role: null });
    expect(result).toHaveLength(0);
  });

  it("evaluates featureFlag per Workspace and excludes a metric whose flag is disabled", async () => {
    registerMetric(makeMetric({ id: "flagged", featureFlag: "analytics-beta" }));
    vi.mocked(evaluateFeatureFlag).mockResolvedValue(false);
    const result = await listVisibleMetrics({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(result).toHaveLength(0);
    expect(evaluateFeatureFlag).toHaveBeenCalledWith("ws_1", "analytics-beta");
  });

  it("includes a feature-flagged metric once the flag evaluates true", async () => {
    registerMetric(makeMetric({ id: "flagged", featureFlag: "analytics-beta" }));
    vi.mocked(evaluateFeatureFlag).mockResolvedValue(true);
    const result = await listVisibleMetrics({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(result.map((m) => m.id)).toEqual(["flagged"]);
  });

  it("filters by category when provided", async () => {
    registerMetric(makeMetric({ id: "rev", category: "revenue" }));
    registerMetric(makeMetric({ id: "wf", category: "workflow" }));
    const result = await listVisibleMetrics({ workspaceId: "ws_1", permissions: [], role: "owner", category: "workflow" });
    expect(result.map((m) => m.id)).toEqual(["wf"]);
  });
});
