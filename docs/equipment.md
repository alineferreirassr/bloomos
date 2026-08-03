# Equipment Registry

v2.0 Checkpoint 26, Step 10. A straightforward CRUD registry for field equipment (cameras, drones, lighting rigs, tools) that can be assigned to a Worker — not an inventory-management system (that's `inventory_item`, Checkpoint-era Inventory Foundation, a separate and unrelated concept: `inventory_item` tracks stock/quantity for sale or consumption, `equipment` tracks a specific reusable asset a worker checks out).

## Equipment

```ts
interface Equipment {
  id: string;
  workspace_id: string;
  name: string;
  category: string;
  status: EquipmentStatus; // available | in_use | maintenance | retired
  assigned_worker_id: string | null;
  serial_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
```

## Status follows assignment automatically

`assignEquipmentAction(equipmentId, workerId)` sets `status: "in_use"` when `workerId` is non-null, and `status: "available"` when clearing the assignment (`workerId: null`). `maintenance`/`retired` are set independently via `setEquipmentStatusAction` and are never overwritten by an assignment change — assigning equipment currently in `maintenance` isn't blocked at the store layer (this checkpoint has no cross-field validation rule for it), but the dashboard surfaces the maintenance count so a real workflow gate can be added later without changing this shape.

## Knowledge Graph

`equipment` is a first-class `KnowledgeNodeType` this checkpoint (via the same `ENTITY_TYPES` extension `worker`/`team`/`vehicle` got). The Assignment Engine creates a real `worker --assigned_to--> equipment` relationship when a worker is assigned equipment through `createAssignmentAction` with `assignable_type: "equipment"` — see [`assignment-engine.md`](assignment-engine.md). `assignEquipmentAction` itself (equipment-initiated assignment, used by the Equipment tab of the dashboard) only updates `assigned_worker_id`/`status` directly; it does not also create a Knowledge Graph relationship, to avoid two different write paths racing to create the same edge. A future checkpoint reconciling the two paths into one is reasonable follow-up work.

## Utilization

`core/workforce/equipmentEngine.ts`'s `computeEquipmentUtilization(equipment)` buckets every item into exactly one status count — the figures the Workforce Dashboard's Equipment card reads directly.
