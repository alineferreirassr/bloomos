import { describe, expect, it } from "vitest";
import { computeResourceOverview, type ResourceOverviewSourceData } from "@/core/operationsCenter/resourceOverviewEngine";
import type { AvailabilitySummary } from "@/types/workforce";
import type { EquipmentUtilization } from "@/core/workforce/equipmentEngine";
import type { VehicleUtilization } from "@/core/workforce/vehicleEngine";

function makeAvailability(overrides: Partial<AvailabilitySummary> = {}): AvailabilitySummary {
  return { available: 5, onAssignment: 3, busy: 1, onBreak: 1, offDuty: 2, vacation: 1, sickLeave: 0, training: 1, unavailable: 0, ...overrides };
}

function makeEquipment(overrides: Partial<EquipmentUtilization> = {}): EquipmentUtilization {
  return { totalCount: 10, inUseCount: 4, availableCount: 5, maintenanceCount: 1, retiredCount: 0, ...overrides };
}

function makeVehicles(overrides: Partial<VehicleUtilization> = {}): VehicleUtilization {
  return { totalCount: 6, inUseCount: 2, availableCount: 3, maintenanceCount: 1, retiredCount: 0, ...overrides };
}

function baseData(overrides: Partial<ResourceOverviewSourceData> = {}): ResourceOverviewSourceData {
  return { availabilitySummary: null, teamsActive: 0, equipmentUtilization: null, vehicleUtilization: null, criticalSinglePointsOfFailure: [], ...overrides };
}

describe("computeResourceOverview", () => {
  it("is zeroed out when every source is null/empty", () => {
    const overview = computeResourceOverview(baseData());
    expect(overview.workersAvailable).toBe(0);
    expect(overview.workersBusy).toBe(0);
    expect(overview.workersOffline).toBe(0);
    expect(overview.equipmentAvailable).toBe(0);
    expect(overview.vehiclesAvailable).toBe(0);
  });

  it("folds the 9-state AvailabilitySummary into available/busy/offline without any new calculation", () => {
    const overview = computeResourceOverview(baseData({ availabilitySummary: makeAvailability() }));
    expect(overview.workersAvailable).toBe(5);
    expect(overview.workersBusy).toBe(4); // onAssignment (3) + busy (1)
    expect(overview.workersOffline).toBe(5); // onBreak(1) + offDuty(2) + vacation(1) + sickLeave(0) + training(1) + unavailable(0)
    expect(overview.workersInActiveOperations).toBe(3); // onAssignment
  });

  it("reuses teamsActive verbatim from the Workforce Scorecard's own count", () => {
    expect(computeResourceOverview(baseData({ teamsActive: 6 })).teamsActive).toBe(6);
  });

  it("splits EquipmentUtilization/VehicleUtilization into available/assigned/unavailable buckets", () => {
    const overview = computeResourceOverview(baseData({ equipmentUtilization: makeEquipment(), vehicleUtilization: makeVehicles() }));
    expect(overview.equipmentAvailable).toBe(5);
    expect(overview.equipmentAssigned).toBe(4);
    expect(overview.equipmentUnavailable).toBe(1);
    expect(overview.vehiclesAvailable).toBe(3);
    expect(overview.vehiclesAssigned).toBe(2);
    expect(overview.vehiclesUnavailable).toBe(1);
  });

  it("passes through caller-supplied single points of failure without inventing its own", () => {
    const overview = computeResourceOverview(baseData({ criticalSinglePointsOfFailure: ["worker_7 is the only certified crane operator"] }));
    expect(overview.criticalSinglePointsOfFailure).toEqual(["worker_7 is the only certified crane operator"]);
  });
});
