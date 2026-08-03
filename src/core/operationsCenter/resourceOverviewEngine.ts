import type { AvailabilitySummary } from "@/types/workforce";
import type { EquipmentUtilization } from "@/core/workforce/equipmentEngine";
import type { VehicleUtilization } from "@/core/workforce/vehicleEngine";
import type { ResourceOverview } from "@/types/operationsCenter";

/**
 * v2.0 Checkpoint 31, Step 12 — Resource Overview. Every figure below is
 * read straight off Workforce's own already-computed outputs — the real
 * `AvailabilitySummary` (from `computeAvailabilitySummary`), `teamsCount`
 * (from `WorkforceScorecard`), and `EquipmentUtilization`/
 * `VehicleUtilization` — folded into this view's coarser buckets. No new
 * eligibility, availability, or utilization calculation happens here;
 * this engine only regroups numbers Workforce already produced.
 *
 * `AvailabilitySummary`'s 9 states fold into 3 buckets: `available` stays
 * available; `onAssignment`/`busy` become "busy" (actively committed to
 * work right now); every other state (`onBreak`/`offDuty`/`vacation`/
 * `sickLeave`/`training`/`unavailable`) becomes "offline" (not working
 * and not immediately assignable).
 *
 * `criticalSinglePointsOfFailure` has no dedicated detector in this
 * checkpoint yet — Capability's own Coverage/Risk engines would be the
 * real source for "only one worker holds this certification" — so it is
 * accepted as a plain input array rather than fabricated here.
 */
export interface ResourceOverviewSourceData {
  availabilitySummary: AvailabilitySummary | null;
  teamsActive: number;
  equipmentUtilization: EquipmentUtilization | null;
  vehicleUtilization: VehicleUtilization | null;
  criticalSinglePointsOfFailure: string[];
}

export function computeResourceOverview(data: ResourceOverviewSourceData): ResourceOverview {
  const availability = data.availabilitySummary;
  const workersAvailable = availability?.available ?? 0;
  const workersBusy = (availability?.onAssignment ?? 0) + (availability?.busy ?? 0);
  const workersOffline = (availability?.onBreak ?? 0) + (availability?.offDuty ?? 0) + (availability?.vacation ?? 0) + (availability?.sickLeave ?? 0) + (availability?.training ?? 0) + (availability?.unavailable ?? 0);
  const workersInActiveOperations = availability?.onAssignment ?? 0;

  const equipment = data.equipmentUtilization;
  const vehicles = data.vehicleUtilization;

  return {
    workersAvailable,
    workersBusy,
    workersOffline,
    workersInActiveOperations,
    teamsActive: data.teamsActive,
    equipmentAvailable: equipment?.availableCount ?? 0,
    equipmentAssigned: equipment?.inUseCount ?? 0,
    equipmentUnavailable: (equipment?.maintenanceCount ?? 0) + (equipment?.retiredCount ?? 0),
    vehiclesAvailable: vehicles?.availableCount ?? 0,
    vehiclesAssigned: vehicles?.inUseCount ?? 0,
    vehiclesUnavailable: (vehicles?.maintenanceCount ?? 0) + (vehicles?.retiredCount ?? 0),
    criticalSinglePointsOfFailure: data.criticalSinglePointsOfFailure,
  };
}
