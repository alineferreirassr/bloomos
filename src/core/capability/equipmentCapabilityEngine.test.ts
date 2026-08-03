import { describe, expect, it } from "vitest";
import { evaluateEquipmentCapability } from "@/core/capability/equipmentCapabilityEngine";
import type { Equipment } from "@/types/workforce";

function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: "equipment_1",
    workspace_id: "ws_1",
    name: "Drone A",
    category: "drone",
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

describe("evaluateEquipmentCapability", () => {
  it("satisfies a required type via the worker's own equipment, even if in_use", () => {
    const result = evaluateEquipmentCapability(["drone"], [], [makeEquipment({ status: "in_use" })], []);
    expect(result.satisfiedRequiredTypes).toEqual(["drone"]);
  });

  it("does not satisfy via the worker's own equipment when in maintenance or retired", () => {
    expect(evaluateEquipmentCapability(["drone"], [], [makeEquipment({ status: "maintenance" })], []).missingRequiredTypes).toEqual(["drone"]);
    expect(evaluateEquipmentCapability(["drone"], [], [makeEquipment({ status: "retired" })], []).missingRequiredTypes).toEqual(["drone"]);
  });

  it("satisfies via team-pooled equipment only while it's genuinely available", () => {
    expect(evaluateEquipmentCapability(["drone"], [], [], [makeEquipment({ status: "available" })]).satisfiedRequiredTypes).toEqual(["drone"]);
    expect(evaluateEquipmentCapability(["drone"], [], [], [makeEquipment({ status: "in_use" })]).missingRequiredTypes).toEqual(["drone"]);
  });

  it("reports missing types with no matching equipment anywhere", () => {
    expect(evaluateEquipmentCapability(["camera"], [], [], []).missingRequiredTypes).toEqual(["camera"]);
  });

  it("tracks matched and unmatched preferred types independently of required", () => {
    const result = evaluateEquipmentCapability([], ["drone", "camera"], [makeEquipment({ category: "drone" })], []);
    expect(result.matchedPreferredTypes).toEqual(["drone"]);
    expect(result.unmatchedPreferredTypes).toEqual(["camera"]);
  });
});
