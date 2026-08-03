import type { Equipment } from "@/types/workforce";

/** v2.0 Checkpoint 26, Step 10 — Equipment Registry's only real logic. */
export interface EquipmentUtilization {
  totalCount: number;
  inUseCount: number;
  availableCount: number;
  maintenanceCount: number;
  retiredCount: number;
}

export function computeEquipmentUtilization(equipment: Equipment[]): EquipmentUtilization {
  return {
    totalCount: equipment.length,
    inUseCount: equipment.filter((e) => e.status === "in_use").length,
    availableCount: equipment.filter((e) => e.status === "available").length,
    maintenanceCount: equipment.filter((e) => e.status === "maintenance").length,
    retiredCount: equipment.filter((e) => e.status === "retired").length,
  };
}
