import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouteOptimizationDashboardView } from "@/modules/routeOptimization/components/RouteOptimizationDashboardView";
import type { EvaluateRouteOptimizationPlatformHealthResult } from "@/modules/routeOptimization/routeOptimizationActions";
import type { RoutePlan, RouteVersion } from "@/types/routeOptimization";

vi.mock("@/modules/routeOptimization/routeOptimizationActions", () => ({
  listRoutePlansAction: vi.fn(),
  evaluateRouteOptimizationPlatformHealthAction: vi.fn(),
}));

import { listRoutePlansAction, evaluateRouteOptimizationPlatformHealthAction } from "@/modules/routeOptimization/routeOptimizationActions";

const NOW = "2026-01-01T00:00:00.000Z";

function makeVersion(overrides: Partial<RouteVersion> = {}): RouteVersion {
  return {
    id: "route_version_1",
    route_plan_id: "route_plan_abcd1234",
    version_number: 1,
    snapshot: { id: "route_snapshot_1", captured_at: NOW, waypoints: [], segments: [], travel_legs: [], constraints: [], optimization_result: null },
    created_at: NOW,
    ...overrides,
  };
}

function makeRoutePlan(overrides: Partial<RoutePlan> = {}): RoutePlan {
  return {
    id: "route_plan_abcd1234",
    workspace_id: "ws_1",
    dispatch_order_id: "dispatch_order_1",
    dispatch_assignment_id: "assignment_1",
    execution_package_id: "package_1",
    execution_version_id: "version_1",
    operational_plan_id: "plan_1",
    priority: "medium",
    context: null,
    status: "draft",
    versions: [makeVersion()],
    created_by: "member_1",
    created_at: NOW,
    updated_at: NOW,
    archived_at: null,
    ...overrides,
  };
}

function makeHealth(overrides: Partial<EvaluateRouteOptimizationPlatformHealthResult> = {}): EvaluateRouteOptimizationPlatformHealthResult {
  return { results: [], findings: [], ...overrides };
}

function mockAllSucceed(overrides: Partial<EvaluateRouteOptimizationPlatformHealthResult> = {}) {
  const routePlan = makeRoutePlan();
  vi.mocked(listRoutePlansAction).mockResolvedValue({ success: true, data: [routePlan] });
  vi.mocked(evaluateRouteOptimizationPlatformHealthAction).mockResolvedValue({
    success: true,
    data: makeHealth({
      results: [
        {
          routePlan,
          snapshot: routePlan.versions[0].snapshot,
          validation: { valid: true, errors: [], warnings: [] },
          travelEstimate: { estimatedTravelMinutes: 0, estimatedDistanceKm: 0, estimatedDepartureAt: null, estimatedArrivalAt: null, estimatedIdleMinutes: 0, estimatedTotalDurationMinutes: 0 },
          optimization: null,
          health: { travelHealth: 100, efficiencyHealth: 100, delayRisk: 0, constraintHealth: 100, optimizationHealth: 100, overallRouteHealth: 100 },
          explanation: { summary: "", optimizationDecisions: [], rejectedRouteReasons: [], constraintViolations: [], travelEstimateSummary: "", optimizationScoreSummary: "", healthSummary: "" },
        },
      ],
      ...overrides,
    }),
  });
}

beforeEach(() => {
  vi.mocked(listRoutePlansAction).mockReset();
  vi.mocked(evaluateRouteOptimizationPlatformHealthAction).mockReset();
});

describe("RouteOptimizationDashboardView", () => {
  it("renders KPI cards and the route plans list once data resolves", async () => {
    mockAllSucceed();
    render(<RouteOptimizationDashboardView />);

    expect(await screen.findByText("Route Plan #abcd1234")).toBeInTheDocument();
    expect(screen.getByText("No high-severity findings.")).toBeInTheDocument();
    expect(screen.getByText("No routes currently violate a declared constraint.")).toBeInTheDocument();
  });

  it("renders an error state when the health evaluation fails", async () => {
    vi.mocked(listRoutePlansAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateRouteOptimizationPlatformHealthAction).mockResolvedValue({ success: false, error: "Access denied." });

    render(<RouteOptimizationDashboardView />);
    expect(await screen.findByText("Access denied.")).toBeInTheDocument();
  });

  it("surfaces a high-severity finding in its own section", async () => {
    mockAllSucceed({ findings: [{ id: "finding_1", type: "high_delay_risk", severity: "high", description: "This route plan has a high delay risk.", relatedRoutePlanId: "route_plan_abcd1234" }] });
    render(<RouteOptimizationDashboardView />);
    expect(await screen.findByText("This route plan has a high delay risk.")).toBeInTheDocument();
  });

  it("shows an empty state when there are no route plans", async () => {
    vi.mocked(listRoutePlansAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateRouteOptimizationPlatformHealthAction).mockResolvedValue({ success: true, data: makeHealth() });

    render(<RouteOptimizationDashboardView />);
    expect(await screen.findByText("No route plans yet")).toBeInTheDocument();
  });

  it("lists a constraint violation when constraintHealth is below 100", async () => {
    const routePlan = makeRoutePlan();
    vi.mocked(listRoutePlansAction).mockResolvedValue({ success: true, data: [routePlan] });
    vi.mocked(evaluateRouteOptimizationPlatformHealthAction).mockResolvedValue({
      success: true,
      data: makeHealth({
        results: [
          {
            routePlan,
            snapshot: routePlan.versions[0].snapshot,
            validation: { valid: true, errors: [], warnings: [] },
            travelEstimate: { estimatedTravelMinutes: 0, estimatedDistanceKm: 0, estimatedDepartureAt: null, estimatedArrivalAt: null, estimatedIdleMinutes: 0, estimatedTotalDurationMinutes: 0 },
            optimization: null,
            health: { travelHealth: 100, efficiencyHealth: 100, delayRisk: 0, constraintHealth: 50, optimizationHealth: 100, overallRouteHealth: 90 },
            explanation: { summary: "", optimizationDecisions: [], rejectedRouteReasons: [], constraintViolations: ["Travel must stay under 10 minutes."], travelEstimateSummary: "", optimizationScoreSummary: "", healthSummary: "" },
          },
        ],
      }),
    });

    render(<RouteOptimizationDashboardView />);
    expect(await screen.findByText("Constraint health 50/100")).toBeInTheDocument();
  });
});
