/**
 * What Inventory a Service typically needs. `inventory_item_id` is nullable
 * — the same "reserve the nullable reference before both sides are ready"
 * shape InventoryItem.primary_vendor_id already established — so a template
 * can name a specific real InventoryItem, or just describe what's needed by
 * `item_name` alone before a matching Inventory item exists yet. Never
 * decrements real Inventory quantities itself; see
 * EventServiceInventoryRequirement (types/eventServiceInventoryRequirement.ts)
 * for the generated, human-fulfilled instance this produces on assignment.
 * A `resource_package_id` alternative (so one row can expand to many
 * Inventory items via a reusable Resource Package) is a Phase 2c addition,
 * not modeled yet.
 */
export interface ServiceInventoryTemplateItem {
  id: string;
  workspace_id: string;
  service_version_id: string;
  inventory_item_id: string | null;
  item_name: string;
  quantity: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}
