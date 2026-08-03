import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockVehiclesRepository, resetVehiclesStore, type CreateVehicleInput } from "@/lib/data/mock/vehiclesStore";

const baseInput: CreateVehicleInput = { label: "Van 1", vehicle_type: "van", make: "Mercedes", model: "Sprinter", year: 2024, license_plate: "ABC-1234", notes: null };

beforeEach(() => resetVehiclesStore());
afterEach(() => resetVehiclesStore());

describe("mockVehiclesRepository", () => {
  it("creates a vehicle defaulting to available status", async () => {
    const result = await mockVehiclesRepository.createVehicle("ws_1", baseInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("available");
  });

  it("rejects a blank label", async () => {
    const result = await mockVehiclesRepository.createVehicle("ws_1", { ...baseInput, label: " " });
    expect(result.success).toBe(false);
  });

  it("assignVehicle sets status to in_use when assigning a worker, available when clearing", async () => {
    const created = await mockVehiclesRepository.createVehicle("ws_1", baseInput);
    if (!created.success) return;

    const assigned = await mockVehiclesRepository.assignVehicle(created.data.id, "ws_1", "worker_1");
    expect(assigned.success).toBe(true);
    if (assigned.success) expect(assigned.data.status).toBe("in_use");

    const cleared = await mockVehiclesRepository.assignVehicle(created.data.id, "ws_1", null);
    expect(cleared.success).toBe(true);
    if (cleared.success) expect(cleared.data.status).toBe("available");
  });

  it("setVehicleStatus updates status directly", async () => {
    const created = await mockVehiclesRepository.createVehicle("ws_1", baseInput);
    if (!created.success) return;
    const result = await mockVehiclesRepository.setVehicleStatus(created.data.id, "ws_1", "maintenance");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("maintenance");
  });
});
