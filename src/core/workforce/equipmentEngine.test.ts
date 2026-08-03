import { describe, expect, it } from "vitest";
import { computeEquipmentUtilization } from "@/core/workforce/equipmentEngine";
import type { Equipment } from "@/types/workforce";

function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: "equipment_1",
    workspace_id: "ws_1",
    name: "Drone A",
    category: "media",
    status: "available",
    assigned_worker_id: null,
    serial_number: null,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

describe("computeEquipmentUtilization", () => {
  it("buckets every item into exactly one status", () => {
    const items = [makeEquipment({ id: "1", status: "available" }), makeEquipment({ id: "2", status: "in_use" }), makeEquipment({ id: "3", status: "maintenance" }), makeEquipment({ id: "4", status: "retired" })];
    const utilization = computeEquipmentUtilization(items);
    expect(utilization).toEqual({ totalCount: 4, inUseCount: 1, availableCount: 1, maintenanceCount: 1, retiredCount: 1 });
  });

  it("returns all zeros for an empty list", () => {
    expect(computeEquipmentUtilization([])).toEqual({ totalCount: 0, inUseCount: 0, availableCount: 0, maintenanceCount: 0, retiredCount: 0 });
  });
});
