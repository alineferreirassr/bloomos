import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEquipmentRepository, resetEquipmentStore, type CreateEquipmentInput } from "@/lib/data/mock/equipmentStore";

const baseInput: CreateEquipmentInput = { name: "Drone A", category: "media", serial_number: "SN-1", notes: null };

beforeEach(() => resetEquipmentStore());
afterEach(() => resetEquipmentStore());

describe("mockEquipmentRepository", () => {
  it("creates equipment defaulting to available status", async () => {
    const result = await mockEquipmentRepository.createEquipment("ws_1", baseInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("available");
  });

  it("rejects a blank name", async () => {
    const result = await mockEquipmentRepository.createEquipment("ws_1", { ...baseInput, name: " " });
    expect(result.success).toBe(false);
  });

  it("assignEquipment sets status to in_use when assigning a worker, available when clearing", async () => {
    const created = await mockEquipmentRepository.createEquipment("ws_1", baseInput);
    if (!created.success) return;

    const assigned = await mockEquipmentRepository.assignEquipment(created.data.id, "ws_1", "worker_1");
    expect(assigned.success).toBe(true);
    if (assigned.success) {
      expect(assigned.data.status).toBe("in_use");
      expect(assigned.data.assigned_worker_id).toBe("worker_1");
    }

    const cleared = await mockEquipmentRepository.assignEquipment(created.data.id, "ws_1", null);
    expect(cleared.success).toBe(true);
    if (cleared.success) expect(cleared.data.status).toBe("available");
  });

  it("lists equipment scoped to the workspace, excluding archived by default", async () => {
    await mockEquipmentRepository.createEquipment("ws_1", baseInput);
    await mockEquipmentRepository.createEquipment("ws_2", baseInput);
    expect(await mockEquipmentRepository.listEquipmentForWorkspace("ws_1")).toHaveLength(1);
  });
});
