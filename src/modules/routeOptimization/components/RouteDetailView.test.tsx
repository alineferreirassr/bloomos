import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouteDetailView } from "@/modules/routeOptimization/components/RouteDetailView";
import type { RoutePlan, RouteVersion, Route, Waypoint } from "@/types/routeOptimization";

vi.mock("@/modules/routeOptimization/routeOptimizationActions", () => ({
  getRoutePlanAction: vi.fn(),
  evaluateRoutePlanAction: vi.fn(),
}));

import { getRoutePlanAction, evaluateRoutePlanAction } from "@/modules/routeOptimization/routeOptimizationActions";

const NOW = "2026-01-01T00:00:00.000Z";

const ORIGIN: Waypoint = { id: "wp_origin", route_plan_id: "route_plan_abcd1234", sequence_index: 0, kind: "origin", label: "Origin", phase_id: null };
const STOP: Waypoint = { id: "wp_stop", route_plan_id: "route_plan_abcd1234", sequence_index: 1, kind: "phase_stop", label: "Setup", phase_id: "phase_1" };

function makeVersion(overrides: Partial<RouteVersion> = {}): RouteVersion {
  return {
    id: "route_version_1",
    route_plan_id: "route_plan_abcd1234",
    version_number: 1,
    snapshot: { id: "route_snapshot_1", captured_at: NOW, waypoints: [ORIGIN, STOP], segments: [], travel_legs: [], constraints: [], optimization_result: null },
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

const PERFECT_RESULT: Route = {
  routePlan: makeRoutePlan(),
  snapshot: makeVersion().snapshot,
  validation: { valid: true, errors: [], warnings: [] },
  travelEstimate: { estimatedTravelMinutes: 20, estimatedDistanceKm: 10, estimatedDepartureAt: null, estimatedArrivalAt: null, estimatedIdleMinutes: 0, estimatedTotalDurationMinutes: 50 },
  optimization: { optimizedWaypointOrder: ["wp_stop"], totalTravelMinutes: 20, totalIdleMinutes: 0, travelEfficiency: 80, resourceUtilization: 100, optimizationScore: 90, improved: false },
  health: { travelHealth: 100, efficiencyHealth: 80, delayRisk: 0, constraintHealth: 100, optimizationHealth: 90, overallRouteHealth: 94 },
  explanation: { summary: "Route is valid — Overall route health 94/100.", optimizationDecisions: ["Stop order optimized to: wp_stop"], rejectedRouteReasons: [], constraintViolations: [], travelEstimateSummary: "Estimated travel: 20m over 10km.", optimizationScoreSummary: "Optimization score 90/100.", healthSummary: "Overall route health 94/100." },
};

beforeEach(() => {
  vi.mocked(getRoutePlanAction).mockReset();
  vi.mocked(evaluateRoutePlanAction).mockReset();
});

describe("RouteDetailView", () => {
  it("renders the route plan's id, status, and waypoints", async () => {
    vi.mocked(getRoutePlanAction).mockResolvedValue({ success: true, data: makeRoutePlan() });

    render(<RouteDetailView routePlanId="route_plan_abcd1234" />);

    expect(await screen.findByRole("heading", { name: "Route Plan #abcd1234" })).toBeInTheDocument();
    expect(screen.getByText(/1\. Origin/)).toBeInTheDocument();
    expect(screen.getByText(/2\. Setup/)).toBeInTheDocument();
  });

  it("renders an error state when the route plan can't be found", async () => {
    vi.mocked(getRoutePlanAction).mockResolvedValue({ success: false, error: "This route plan could not be found." });

    render(<RouteDetailView routePlanId="route_plan_missing" />);
    expect(await screen.findByText("This route plan could not be found.")).toBeInTheDocument();
  });

  it("re-derives and displays health/travel estimate when Evaluate is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    vi.mocked(getRoutePlanAction).mockResolvedValue({ success: true, data: makeRoutePlan() });
    vi.mocked(evaluateRoutePlanAction).mockResolvedValue({ success: true, data: PERFECT_RESULT });

    render(<RouteDetailView routePlanId="route_plan_abcd1234" />);
    const evaluateButton = await screen.findByRole("button", { name: "Evaluate" });
    await userEvent.click(evaluateButton);

    expect(await screen.findByText("Route is valid — Overall route health 94/100.")).toBeInTheDocument();
    expect(screen.getByText("Optimization score 90/100.")).toBeInTheDocument();
  });
});
