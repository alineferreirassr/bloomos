# Vehicle Registry

v2.0 Checkpoint 26, Step 11. A CRUD registry for the fleet — vans, trucks, anything a worker drives to a job — assignable to a Worker. Mirrors [`equipment.md`](equipment.md)'s shape and rules exactly; the two are deliberately parallel rather than unified into one generic "resource" concept, because a Vehicle carries fields (`make`/`model`/`year`/`license_plate`) that make no sense on a camera or a drone.

## Vehicle

```ts
interface Vehicle {
  id: string;
  workspace_id: string;
  label: string;
  make: string | null;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  status: VehicleStatus; // available | in_use | maintenance | retired
  assigned_worker_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
```

## Status follows assignment automatically

Same rule as Equipment: `assignVehicleAction(vehicleId, workerId)` sets `status: "in_use"` when assigning, `"available"` when clearing. `maintenance`/`retired` are independent, set via `setVehicleStatusAction`.

## Knowledge Graph

`vehicle` is a first-class `KnowledgeNodeType` this checkpoint. The Assignment Engine creates a real `worker --assigned_to--> vehicle` relationship when a worker is assigned a vehicle through `createAssignmentAction` with `assignable_type: "vehicle"` — see [`assignment-engine.md`](assignment-engine.md). Same caveat as Equipment: the vehicle-initiated `assignVehicleAction` path (used by the dashboard's Vehicles tab) does not itself create a second Knowledge Graph relationship.

## Explicitly out of scope

No route planning, no mileage tracking, no maintenance scheduling, no fuel logs — this is a registry and an assignment target, nothing more, per the stop condition ("Do NOT implement route optimization").

## Utilization

`core/workforce/vehicleEngine.ts`'s `computeVehicleUtilization(vehicles)` — identical shape to Equipment's utilization function, read directly by the Workforce Dashboard's Vehicles card.
