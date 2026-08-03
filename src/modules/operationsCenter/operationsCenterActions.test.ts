import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  evaluateOperationsCenterAction,
  getOperationsBriefAction,
  getOperationalFeedAction,
  listOperationalAlertsAction,
  getOperationalAlertAction,
  acknowledgeAlertAction,
  resolveAlertAction,
  dismissAlertAction,
  escalateAlertAction,
  listOperationalIncidentsAction,
  getOperationalIncidentAction,
  setIncidentStatusAction,
} from "@/modules/operationsCenter/operationsCenterActions";

import { resetOperationalAlertsStore, mockOperationalAlertsRepository } from "@/lib/data/mock/operationalAlertsStore";
import { resetOperationalIncidentsStore, mockOperationalIncidentsRepository } from "@/lib/data/mock/operationalIncidentsStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";
import { resetDispatchOrdersStore } from "@/lib/data/mock/dispatchOrdersStore";
import { resetDispatchBatchesStore } from "@/lib/data/mock/dispatchBatchesStore";
import { resetFieldOperationsStore } from "@/lib/data/mock/fieldOperationsStore";
import { resetRouteOptimizationStore } from "@/lib/data/mock/routeOptimizationStore";
import { resetCalendarsStore } from "@/lib/data/mock/calendarsStore";
import { resetAppointmentsStore } from "@/lib/data/mock/appointmentsStore";
import { resetReservationsStore } from "@/lib/data/mock/reservationsStore";
import { resetCalendarWindowsStore } from "@/lib/data/mock/calendarWindowsStore";
import { resetWorkingHoursStore } from "@/lib/data/mock/workingHoursStore";
import { resetCapacityRulesStore } from "@/lib/data/mock/capacityRulesStore";
import { resetHolidaysStore } from "@/lib/data/mock/holidaysStore";
import { resetAllocationsStore } from "@/lib/data/mock/allocationsStore";
import { resetAllocationRequestsStore } from "@/lib/data/mock/allocationRequestsStore";
import { resetExecutionPackagesStore } from "@/lib/data/mock/executionPackagesStore";
import { resetWorkersStore } from "@/lib/data/mock/workersStore";
import { resetTeamsStore } from "@/lib/data/mock/teamsStore";
import { resetTeamMembersStore } from "@/lib/data/mock/teamMembersStore";
import { resetEquipmentStore } from "@/lib/data/mock/equipmentStore";
import { resetVehiclesStore } from "@/lib/data/mock/vehiclesStore";
import { resetAvailabilityStore } from "@/lib/data/mock/availabilityStore";
import { resetAssignmentsStore } from "@/lib/data/mock/assignmentsStore";
import { resetMobileSessionsStore } from "@/lib/data/mock/mobileSessionsStore";
import { resetOfflineQueueStore } from "@/lib/data/mock/offlineQueueStore";
import { resetLocationStore } from "@/lib/data/mock/locationStore";
import { resetDecisionsStore } from "@/lib/data/mock/decisionsStore";
import { resetObjectivesStore } from "@/lib/data/mock/objectivesStore";
import { resetBusinessHealthSnapshotsStore } from "@/lib/data/mock/businessHealthSnapshotsStore";
import { resetKnowledgeGraphStore } from "@/lib/data/core/knowledge/knowledgeGraphStore";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["assets.view", "assets.manage", "operations_center.view", "operations_alerts.acknowledge", "operations_alerts.resolve", "operations_incidents.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function resetAll(): void {
  resetOperationalAlertsStore();
  resetOperationalIncidentsStore();
  resetTimelineStore();
  resetDispatchOrdersStore();
  resetDispatchBatchesStore();
  resetFieldOperationsStore();
  resetRouteOptimizationStore();
  resetCalendarsStore();
  resetAppointmentsStore();
  resetReservationsStore();
  resetCalendarWindowsStore();
  resetWorkingHoursStore();
  resetCapacityRulesStore();
  resetHolidaysStore();
  resetAllocationsStore();
  resetAllocationRequestsStore();
  resetExecutionPackagesStore();
  resetWorkersStore();
  resetTeamsStore();
  resetTeamMembersStore();
  resetEquipmentStore();
  resetVehiclesStore();
  resetAvailabilityStore();
  resetAssignmentsStore();
  resetMobileSessionsStore();
  resetOfflineQueueStore();
  resetLocationStore();
  resetDecisionsStore();
  resetObjectivesStore();
  resetBusinessHealthSnapshotsStore();
  resetKnowledgeGraphStore();
}

beforeEach(() => {
  resetAll();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  resetAll();
});

describe("evaluateOperationsCenterAction", () => {
  it("rejects a caller with no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await evaluateOperationsCenterAction();
    expect(result.success).toBe(false);
  });

  it("succeeds on an entirely empty workspace, returning vacuous-safe figures from every engine", async () => {
    const result = await evaluateOperationsCenterAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.snapshot.confidence).toBeGreaterThanOrEqual(0);
    expect(result.data.alerts).toEqual([]);
    expect(result.data.incidents).toEqual([]);
    expect(result.data.kpis.declineRate).toBe(0);
    expect(result.data.health.overallOperationsCenterHealth).toBeGreaterThanOrEqual(0);
    expect(result.data.resourceOverview.workersAvailable).toBe(0);
    expect(result.data.locationSummary.knownWorkerLocationsCount).toBe(0);
    expect(typeof result.data.digest).toBe("string");
  });

  it("is idempotent across repeated evaluations — never duplicates alerts on a stable workspace", async () => {
    const first = await evaluateOperationsCenterAction();
    const second = await evaluateOperationsCenterAction();
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.data.alerts.length).toBe(first.data.alerts.length);
  });
});

describe("getOperationsBriefAction", () => {
  it("returns a deterministic brief with no prior KPIs to diff against", async () => {
    const result = await getOperationsBriefAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.recentImprovements).toEqual([]);
    expect(result.data.recentRegressions).toEqual([]);
    expect(typeof result.data.currentOperationalSummary).toBe("string");
  });
});

describe("getOperationalFeedAction", () => {
  it("returns an empty feed on a workspace with no alerts, incidents, or timeline activity", async () => {
    const result = await getOperationalFeedAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual([]);
  });
});

describe("Alert lifecycle actions", () => {
  async function seedAlert() {
    const created = await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", {
      ruleId: "dispatch.assignment_declined",
      category: "dispatch",
      severity: "medium",
      title: "Assignment declined",
      description: "Test alert",
      sourceRef: null,
      sourceRecordId: "assignment_1",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    if (!created.success) throw new Error("failed to seed alert");
    return created.data;
  }

  it("lists and fetches an alert scoped to the caller's own workspace", async () => {
    const alert = await seedAlert();
    const list = await listOperationalAlertsAction();
    expect(list.success && list.data.some((a) => a.id === alert.id)).toBe(true);
    const fetched = await getOperationalAlertAction(alert.id);
    expect(fetched.success && fetched.data.id).toBe(alert.id);
  });

  it("acknowledges an alert and records a Timeline event, never mutating a source module", async () => {
    const alert = await seedAlert();
    const result = await acknowledgeAlertAction(alert.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("acknowledged");
    expect(result.data.acknowledged_by).toBe("member_1");
    const activity = readActivities().find((a) => a.owner_id === alert.id && a.type === "operational_alert_acknowledged");
    expect(activity).toBeDefined();
  });

  it("resolves, dismisses, and escalates an alert, each recording its own named Timeline event", async () => {
    const resolved = await seedAlert();
    const resolveResult = await resolveAlertAction(resolved.id, "Fixed manually.");
    expect(resolveResult.success && resolveResult.data.status).toBe("resolved");
    expect(readActivities().some((a) => a.owner_id === resolved.id && a.type === "operational_alert_resolved")).toBe(true);

    const dismissed = await seedAlert();
    const dismissResult = await dismissAlertAction(dismissed.id, "Not relevant.");
    expect(dismissResult.success && dismissResult.data.status).toBe("dismissed");
    expect(readActivities().some((a) => a.owner_id === dismissed.id && a.type === "operational_alert_dismissed")).toBe(true);

    const escalated = await seedAlert();
    const escalateResult = await escalateAlertAction(escalated.id);
    expect(escalateResult.success && escalateResult.data.status).toBe("escalated");
    expect(readActivities().some((a) => a.owner_id === escalated.id && a.type === "operational_alert_escalated")).toBe(true);
  });
});

describe("Incident lifecycle actions", () => {
  async function seedIncident() {
    const created = await mockOperationalIncidentsRepository.createIncident("ws_1", {
      title: "Multiple critical alerts",
      description: "Test incident",
      severity: "critical",
      source_alert_ids: [],
      related_dispatch_order_ids: [],
      related_field_operation_ids: [],
      related_route_plan_ids: [],
      related_worker_ids: [],
      related_vehicle_ids: [],
      related_equipment_ids: [],
      owner_member_id: null,
    });
    if (!created.success) throw new Error("failed to seed incident");
    return created.data;
  }

  it("lists and fetches an incident scoped to the caller's own workspace", async () => {
    const incident = await seedIncident();
    const list = await listOperationalIncidentsAction();
    expect(list.success && list.data.some((i) => i.id === incident.id)).toBe(true);
    const fetched = await getOperationalIncidentAction(incident.id);
    expect(fetched.success && fetched.data.id).toBe(incident.id);
  });

  it("transitions incident status and records the matching named Timeline event", async () => {
    const incident = await seedIncident();
    const acknowledged = await setIncidentStatusAction(incident.id, "acknowledged");
    expect(acknowledged.success && acknowledged.data.status).toBe("acknowledged");
    expect(readActivities().some((a) => a.owner_id === incident.id && a.type === "operational_incident_acknowledged")).toBe(true);

    const resolved = await setIncidentStatusAction(incident.id, "resolved", "Confirmed closed.");
    expect(resolved.success && resolved.data.status).toBe("resolved");
    expect(readActivities().some((a) => a.owner_id === incident.id && a.type === "operational_incident_resolved")).toBe(true);
  });
});

describe("permission enforcement (v2 Checkpoint 45 security fix)", () => {
  it("rejects alert lifecycle actions for a session lacking operations_alerts.acknowledge/resolve", async () => {
    const alertCreated = await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", {
      ruleId: "dispatch.assignment_declined",
      category: "dispatch",
      severity: "medium",
      title: "Assignment declined",
      description: "Test alert",
      sourceRef: null,
      sourceRecordId: "assignment_1",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    if (!alertCreated.success) throw new Error("failed to seed alert");

    const viewOnlySession: MemberSessionSnapshot = { ...session, permissions: ["operations_center.view"] };
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);

    expect((await acknowledgeAlertAction(alertCreated.data.id)).success).toBe(false);
    expect((await resolveAlertAction(alertCreated.data.id, "Blocked")).success).toBe(false);
    expect((await dismissAlertAction(alertCreated.data.id, "Blocked")).success).toBe(false);
    expect((await escalateAlertAction(alertCreated.data.id)).success).toBe(false);
  });

  it("rejects setIncidentStatusAction for a session lacking operations_incidents.manage", async () => {
    const incidentCreated = await mockOperationalIncidentsRepository.createIncident("ws_1", {
      title: "Multiple critical alerts",
      description: "Test incident",
      severity: "critical",
      source_alert_ids: [],
      related_dispatch_order_ids: [],
      related_field_operation_ids: [],
      related_route_plan_ids: [],
      related_worker_ids: [],
      related_vehicle_ids: [],
      related_equipment_ids: [],
      owner_member_id: null,
    });
    if (!incidentCreated.success) throw new Error("failed to seed incident");

    const viewOnlySession: MemberSessionSnapshot = { ...session, permissions: ["operations_center.view"] };
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);

    expect((await setIncidentStatusAction(incidentCreated.data.id, "acknowledged")).success).toBe(false);
  });
});
