import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OperationsCenterDashboardView } from "@/modules/operationsCenter/components/OperationsCenterDashboardView";
import type { EvaluateOperationsCenterResult } from "@/modules/operationsCenter/operationsCenterActions";

vi.mock("@/modules/operationsCenter/operationsCenterActions", () => ({
  evaluateOperationsCenterAction: vi.fn(),
  acknowledgeAlertAction: vi.fn(),
  resolveAlertAction: vi.fn(),
}));

import { evaluateOperationsCenterAction, acknowledgeAlertAction } from "@/modules/operationsCenter/operationsCenterActions";

function makeResult(overrides: Partial<EvaluateOperationsCenterResult> = {}): EvaluateOperationsCenterResult {
  return {
    snapshot: {
      workspaceId: "ws_1",
      generatedAt: "2026-01-01T00:00:00.000Z",
      confidence: 100,
      sourceOutcomes: [],
      liveOperations: { activeDispatchOrders: 0, pendingAssignments: 0, acceptedAssignments: 0, declinedAssignments: 0, expiredAssignments: 0, activeFieldOperations: 0, pausedFieldOperations: 0, blockedFieldOperations: 0, completedFieldOperations: 0, activeRoutes: 0, highRiskRoutes: 0 },
      schedulingConflicts: 0,
      capacityAlerts: 0,
      allocationRisks: 0,
      executionPackagesNotReady: 0,
      workersAvailable: 0,
      workersUnavailable: 0,
      equipmentAvailable: 0,
      equipmentUnavailable: 0,
      vehiclesAvailable: 0,
      vehiclesUnavailable: 0,
      criticalExecutiveDecisions: 0,
      blockedObjectives: 0,
      businessHealthScore: 100,
      knowledgeHealthScore: 100,
      recentTimelineActivity: [],
    },
    status: "normal",
    alerts: [],
    incidents: [],
    kpis: {
      activeOperations: 2,
      pausedOperations: 0,
      blockedOperations: 0,
      pendingAcceptances: 1,
      declineRate: 0,
      dispatchQueueHealth: 100,
      routeHealth: 100,
      highRiskRoutes: 0,
      schedulingConflicts: 0,
      capacityUsage: 0,
      availableWorkers: 5,
      unavailableWorkers: 0,
      equipmentInUse: 0,
      vehiclesInUse: 0,
      criticalAlerts: 0,
      openIncidents: 0,
      averageExecutionHealth: 100,
      overallOperationalStatus: "normal",
    },
    health: { dispatchHealth: 100, executionHealth: 100, routeHealth: 100, schedulingHealth: 100, allocationHealth: 100, packageHealth: 100, workforceHealth: 100, businessHealth: 100, knowledgeHealth: 100, objectiveHealth: 100, overallOperationsCenterHealth: 100 },
    priorityQueue: [],
    resourceOverview: { workersAvailable: 5, workersBusy: 0, workersOffline: 0, workersInActiveOperations: 0, teamsActive: 1, equipmentAvailable: 3, equipmentAssigned: 0, equipmentUnavailable: 0, vehiclesAvailable: 2, vehiclesAssigned: 0, vehiclesUnavailable: 0, criticalSinglePointsOfFailure: [] },
    locationSummary: { knownWorkerLocationsCount: 0, knownOperationLocationsCount: 0, knownRouteWaypointsCount: 0, unknownLocationCount: 0, lastLocationTimestamp: null, locationAccuracySummary: "No worker location data is currently available." },
    digest: "Operations status: normal. 2 active operations, 0 paused, 0 blocked. 1 assignment awaiting acceptance. 5 of 5 workers available.",
    ...overrides,
  };
}

describe("OperationsCenterDashboardView", () => {
  it("renders KPIs, status, and the deterministic brief once data loads", async () => {
    vi.mocked(evaluateOperationsCenterAction).mockResolvedValue({ success: true, data: makeResult() });
    render(<OperationsCenterDashboardView />);

    expect(await screen.findByText("Normal")).toBeInTheDocument();
    expect(screen.getByText("Active Operations")).toBeInTheDocument();
    expect(screen.getByText(/Operations status: normal/)).toBeInTheDocument();
  });

  it("shows an accessible empty state when the platform is unavailable", async () => {
    vi.mocked(evaluateOperationsCenterAction).mockResolvedValue({ success: false, error: "The operations center isn't available. You may not have access to it." });
    render(<OperationsCenterDashboardView />);
    expect(await screen.findByText("The Operations Center isn't available")).toBeInTheDocument();
    expect(screen.getByText("The operations center isn't available. You may not have access to it.")).toBeInTheDocument();
  });

  it("shows a success message and no open-alerts warning when there are none", async () => {
    vi.mocked(evaluateOperationsCenterAction).mockResolvedValue({ success: true, data: makeResult() });
    render(<OperationsCenterDashboardView />);
    expect(await screen.findByText("No open alerts.")).toBeInTheDocument();
    expect(screen.getByText("No open incidents.")).toBeInTheDocument();
  });

  it("acknowledges an open alert and refreshes the dashboard", async () => {
    const alert = {
      id: "operational_alert_1",
      workspace_id: "ws_1",
      rule_id: "dispatch.assignment_declined",
      category: "dispatch" as const,
      severity: "critical" as const,
      title: "Assignment declined",
      description: "Test alert",
      source_ref: null,
      source_record_id: "assignment_1",
      status: "open" as const,
      acknowledged_by: null,
      acknowledged_at: null,
      resolved_by: null,
      resolved_at: null,
      resolution_reason: null,
      dismissed_at: null,
      escalated_at: null,
      expires_at: null,
      dedupe_key: "k1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    vi.mocked(evaluateOperationsCenterAction).mockResolvedValueOnce({ success: true, data: makeResult({ alerts: [alert] }) }).mockResolvedValue({ success: true, data: makeResult({ alerts: [{ ...alert, status: "acknowledged", acknowledged_by: "member_1", acknowledged_at: "2026-01-01T00:05:00.000Z" }] }) });
    vi.mocked(acknowledgeAlertAction).mockResolvedValue({ success: true, data: { ...alert, status: "acknowledged", acknowledged_by: "member_1", acknowledged_at: "2026-01-01T00:05:00.000Z" } });

    const user = userEvent.setup();
    render(<OperationsCenterDashboardView />);

    const acknowledgeButton = await screen.findByRole("button", { name: "Acknowledge" });
    await user.click(acknowledgeButton);

    await waitFor(() => expect(acknowledgeAlertAction).toHaveBeenCalledWith("operational_alert_1"));
    expect(await screen.findByRole("button", { name: "Resolve" })).toBeInTheDocument();
  });
});
