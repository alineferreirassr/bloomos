import { beforeEach, describe, expect, it } from "vitest";
import { resetOperationalIncidentsStore, mockOperationalIncidentsRepository, type CreateIncidentInput } from "@/lib/data/mock/operationalIncidentsStore";

function baseInput(overrides: Partial<CreateIncidentInput> = {}): CreateIncidentInput {
  return {
    title: "Multiple dispatch delays",
    description: "Several dispatch orders are blocked at once.",
    severity: "high",
    source_alert_ids: ["operational_alert_1"],
    related_dispatch_order_ids: ["dispatch_order_1"],
    related_field_operation_ids: [],
    related_route_plan_ids: [],
    related_worker_ids: [],
    related_vehicle_ids: [],
    related_equipment_ids: [],
    owner_member_id: "member_1",
    ...overrides,
  };
}

beforeEach(() => {
  resetOperationalIncidentsStore();
});

describe("operationalIncidentsStore", () => {
  it("creates an incident in open status", async () => {
    const result = await mockOperationalIncidentsRepository.createIncident("ws_1", baseInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("open");
    expect(result.data.source_alert_ids).toEqual(["operational_alert_1"]);
  });

  it("lists incidents for a workspace, excluding resolved by default", async () => {
    const created = await mockOperationalIncidentsRepository.createIncident("ws_1", baseInput());
    if (!created.success) throw new Error("failed to create");
    await mockOperationalIncidentsRepository.setIncidentStatus(created.data.id, "ws_1", "resolved", "All clear.");

    const activeOnly = await mockOperationalIncidentsRepository.listIncidentsForWorkspace("ws_1");
    expect(activeOnly).toHaveLength(0);
    const withResolved = await mockOperationalIncidentsRepository.listIncidentsForWorkspace("ws_1", true);
    expect(withResolved).toHaveLength(1);
  });

  it("gets an incident by id, and returns null for one that doesn't exist", async () => {
    const created = await mockOperationalIncidentsRepository.createIncident("ws_1", baseInput());
    if (!created.success) throw new Error("failed to create");
    const fetched = await mockOperationalIncidentsRepository.getIncidentById(created.data.id);
    expect(fetched?.id).toBe(created.data.id);
    expect(await mockOperationalIncidentsRepository.getIncidentById("operational_incident_missing")).toBeNull();
  });

  it("transitions status and stamps acknowledged_at/resolved_at appropriately", async () => {
    const created = await mockOperationalIncidentsRepository.createIncident("ws_1", baseInput());
    if (!created.success) throw new Error("failed to create");

    const acknowledged = await mockOperationalIncidentsRepository.setIncidentStatus(created.data.id, "ws_1", "acknowledged");
    expect(acknowledged.success).toBe(true);
    if (acknowledged.success) expect(acknowledged.data.acknowledged_at).not.toBeNull();

    const resolved = await mockOperationalIncidentsRepository.setIncidentStatus(created.data.id, "ws_1", "resolved", "Confirmed closed.");
    expect(resolved.success).toBe(true);
    if (resolved.success) {
      expect(resolved.data.resolved_at).not.toBeNull();
      expect(resolved.data.resolution_notes).toBe("Confirmed closed.");
    }
  });

  it("adds an alert to an incident without duplicating an already-linked alert", async () => {
    const created = await mockOperationalIncidentsRepository.createIncident("ws_1", baseInput());
    if (!created.success) throw new Error("failed to create");

    const added = await mockOperationalIncidentsRepository.addAlertToIncident(created.data.id, "ws_1", "operational_alert_2");
    expect(added.success).toBe(true);
    if (added.success) expect(added.data.source_alert_ids).toEqual(["operational_alert_1", "operational_alert_2"]);

    const readded = await mockOperationalIncidentsRepository.addAlertToIncident(created.data.id, "ws_1", "operational_alert_2");
    if (readded.success) expect(readded.data.source_alert_ids).toHaveLength(2);
  });

  it("errors when acting on an incident that doesn't exist", async () => {
    const result = await mockOperationalIncidentsRepository.setIncidentStatus("operational_incident_missing", "ws_1", "acknowledged");
    expect(result.success).toBe(false);
  });
});
