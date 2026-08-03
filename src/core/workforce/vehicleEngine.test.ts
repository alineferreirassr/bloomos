import { describe, expect, it } from "vitest";
import { computeVehicleUtilization } from "@/core/workforce/vehicleEngine";
import type { Vehicle } from "@/types/workforce";

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "vehicle_1",
    workspace_id: "ws_1",
    label: "Van 1",
    vehicle_type: "van",
    make: "Mercedes",
    model: "Sprinter",
    year: 2024,
    license_plate: "ABC-1234",
    status: "available",
    assigned_worker_id: null,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

describe("computeVehicleUtilization", () => {
  it("buckets every vehicle into exactly one status", () => {
    const vehicles = [makeVehicle({ id: "1", status: "available" }), makeVehicle({ id: "2", status: "in_use" }), makeVehicle({ id: "3", status: "in_use" })];
    expect(computeVehicleUtilization(vehicles)).toEqual({ totalCount: 3, inUseCount: 2, availableCount: 1, maintenanceCount: 0, retiredCount: 0 });
  });
});
