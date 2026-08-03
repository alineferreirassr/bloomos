import type { Vehicle } from "@/types/workforce";

/** v2.0 Checkpoint 26, Step 11 — Vehicle Registry's only real logic. */
export interface VehicleUtilization {
  totalCount: number;
  inUseCount: number;
  availableCount: number;
  maintenanceCount: number;
  retiredCount: number;
}

export function computeVehicleUtilization(vehicles: Vehicle[]): VehicleUtilization {
  return {
    totalCount: vehicles.length,
    inUseCount: vehicles.filter((v) => v.status === "in_use").length,
    availableCount: vehicles.filter((v) => v.status === "available").length,
    maintenanceCount: vehicles.filter((v) => v.status === "maintenance").length,
    retiredCount: vehicles.filter((v) => v.status === "retired").length,
  };
}
