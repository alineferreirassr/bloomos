import { describe, expect, it } from "vitest";
import { evaluateVehicleCapability } from "@/core/capability/vehicleCapabilityEngine";
import type { Vehicle } from "@/types/workforce";

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "vehicle_1",
    workspace_id: "ws_1",
    label: "Van 1",
    vehicle_type: "van",
    make: null,
    model: null,
    year: null,
    license_plate: null,
    status: "available",
    assigned_worker_id: null,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

describe("evaluateVehicleCapability", () => {
  it("satisfies via the worker's own vehicle, even if in_use", () => {
    const result = evaluateVehicleCapability(["van"], [], makeVehicle({ status: "in_use" }), []);
    expect(result.satisfiedRequiredTypes).toEqual(["van"]);
  });

  it("does not satisfy via a null worker vehicle", () => {
    expect(evaluateVehicleCapability(["van"], [], null, []).missingRequiredTypes).toEqual(["van"]);
  });

  it("does not satisfy via the worker's own vehicle when in maintenance or retired", () => {
    expect(evaluateVehicleCapability(["van"], [], makeVehicle({ status: "maintenance" }), []).missingRequiredTypes).toEqual(["van"]);
  });

  it("satisfies via team-pooled vehicles only while genuinely available", () => {
    expect(evaluateVehicleCapability(["van"], [], null, [makeVehicle({ status: "available" })]).satisfiedRequiredTypes).toEqual(["van"]);
    expect(evaluateVehicleCapability(["van"], [], null, [makeVehicle({ status: "in_use" })]).missingRequiredTypes).toEqual(["van"]);
  });

  it("tracks matched and unmatched preferred types", () => {
    const result = evaluateVehicleCapability([], ["van", "truck"], makeVehicle({ vehicle_type: "van" }), []);
    expect(result.matchedPreferredTypes).toEqual(["van"]);
    expect(result.unmatchedPreferredTypes).toEqual(["truck"]);
  });
});
