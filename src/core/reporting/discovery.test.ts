import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/featureFlags", () => ({
  evaluateFeatureFlag: vi.fn(),
}));

import { registerReportMetric, resetReportMetricRegistry } from "@/core/reporting/metricRegistry";
import { listVisibleReportMetrics } from "@/core/reporting/discovery";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import type { ReportMetricDefinition } from "@/types/reportMetric";

function makeMetric(overrides: Partial<ReportMetricDefinition> = {}): ReportMetricDefinition {
  return {
    id: "test.metric",
    name: "Test Metric",
    description: "",
    category: "custom",
    unit: "count",
    aggregation: "sum",
    sourceModule: "Test",
    sourceEngine: "test()",
    supportedDimensions: [],
    supportedFilters: [],
    freshness: "realtime",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    knownLimitations: [],
    compute: async () => ({ value: 1, previousValue: null, unit: "count", series: [], breakdown: [], notApplicableReason: null, stale: false, partial: false }),
    ...overrides,
  };
}

afterEach(() => {
  resetReportMetricRegistry();
  vi.clearAllMocks();
});

describe("core/reporting/discovery", () => {
  it("hides a metric the member is missing a required permission for", async () => {
    registerReportMetric(makeMetric({ id: "a", requiredPermissions: ["reports.financial"] }));
    const visible = await listVisibleReportMetrics({ workspaceId: "ws_1", permissions: ["reports.view"], role: "manager" });
    expect(visible).toHaveLength(0);
  });

  it("shows a metric once every required permission is held", async () => {
    registerReportMetric(makeMetric({ id: "a", requiredPermissions: ["reports.view", "reports.financial"] }));
    const visible = await listVisibleReportMetrics({ workspaceId: "ws_1", permissions: ["reports.view", "reports.financial"], role: "manager" });
    expect(visible.map((m) => m.id)).toEqual(["a"]);
  });

  it("hides a metric below its minimum role", async () => {
    registerReportMetric(makeMetric({ id: "a", minimumRole: "owner" }));
    const visible = await listVisibleReportMetrics({ workspaceId: "ws_1", permissions: [], role: "staff" });
    expect(visible).toHaveLength(0);
  });

  it("hides a metric when the member has no resolved role", async () => {
    registerReportMetric(makeMetric({ id: "a", minimumRole: "manager" }));
    const visible = await listVisibleReportMetrics({ workspaceId: "ws_1", permissions: [], role: null });
    expect(visible).toHaveLength(0);
  });

  it("hides a metric whose feature flag evaluates false for this workspace", async () => {
    vi.mocked(evaluateFeatureFlag).mockResolvedValue(false);
    registerReportMetric(makeMetric({ id: "a", featureFlag: "reporting-beta" }));
    const visible = await listVisibleReportMetrics({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(visible).toHaveLength(0);
  });

  it("shows a metric whose feature flag evaluates true", async () => {
    vi.mocked(evaluateFeatureFlag).mockResolvedValue(true);
    registerReportMetric(makeMetric({ id: "a", featureFlag: "reporting-beta" }));
    const visible = await listVisibleReportMetrics({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(visible.map((m) => m.id)).toEqual(["a"]);
  });

  it("filters by category when provided", async () => {
    registerReportMetric(makeMetric({ id: "a", category: "finance" }));
    registerReportMetric(makeMetric({ id: "b", category: "commercial" }));
    const visible = await listVisibleReportMetrics({ workspaceId: "ws_1", permissions: [], role: "owner", category: "finance" });
    expect(visible.map((m) => m.id)).toEqual(["a"]);
  });
});
