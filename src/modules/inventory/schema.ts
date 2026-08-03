import { z } from "zod";
import { INVENTORY_ITEM_TYPES } from "@/core/enums/inventoryItemType";
import { INVENTORY_STATUSES } from "@/core/enums/inventoryStatus";
import { INVENTORY_CONDITIONS } from "@/core/enums/inventoryCondition";
import { INVENTORY_MOVEMENT_TYPES } from "@/core/enums/inventoryMovementType";
import { isConditionValidForItemType } from "@/core/workflows/inventoryWorkflow";

/**
 * Shared by create and update — quantities are deliberately absent here.
 * Nothing may set `quantity_on_hand`/`quantity_available`/`quantity_reserved`
 * directly through this schema; they only change via
 * `recordInventoryMovementInputSchema` below, matching "quantities must not
 * rely only on directly overwriting quantity_on_hand."
 */
const inventoryItemBaseSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().nullable(),
  sku: z.string().trim().nullable(),
  category: z.string().trim().nullable(),
  subcategory: z.string().trim().nullable(),
  item_type: z.enum(INVENTORY_ITEM_TYPES),
  /** Never "archived" here — that transition only happens through archiveInventoryItem/restoreInventoryItem. */
  status: z.enum(["active", "inactive"] as const satisfies readonly (typeof INVENTORY_STATUSES)[number][]),
  tags: z.array(z.string()),
  condition: z.enum(INVENTORY_CONDITIONS).nullable(),
  unit_of_measure: z.string().trim().nullable(),
  reorder_level: z.number().int("Reorder level must be a whole number").nonnegative("Reorder level cannot be negative").nullable(),
  target_stock_level: z.number().int("Target stock level must be a whole number").nonnegative("Target stock level cannot be negative").nullable(),
  unit_cost: z.number().int("Unit cost must be an integer (cents)").nonnegative("Unit cost cannot be negative").nullable(),
  replacement_cost: z.number().int("Replacement cost must be an integer (cents)").nonnegative("Replacement cost cannot be negative").nullable(),
  rental_value: z.number().int("Rental value must be an integer (cents)").nonnegative("Rental value cannot be negative").nullable(),
  storage_location: z.string().trim().nullable(),
  bin_location: z.string().trim().nullable(),
  primary_vendor_id: z.string().nullable(),
  purchase_date: z.string().nullable(),
  notes: z.string().trim().nullable(),
  image_url: z.string().trim().nullable(),
});

function refineConditionMatchesItemType<T extends z.ZodType<{ item_type: "consumable" | "reusable"; condition: string | null }>>(schema: T) {
  return schema.refine((data) => isConditionValidForItemType(data.item_type, data.condition as never), {
    message: "A consumable item cannot have a physical condition.",
    path: ["condition"],
  });
}

export const inventoryItemInputSchema = refineConditionMatchesItemType(inventoryItemBaseSchema);
export type InventoryItemInput = z.infer<typeof inventoryItemBaseSchema>;

/** Create-only: the one way an item may start with stock, recorded as its own `initial_stock` movement rather than a bare column write. */
export const createInventoryItemInputSchema = refineConditionMatchesItemType(
  inventoryItemBaseSchema.extend({
    initial_quantity: z.number().int("Initial quantity must be a whole number").nonnegative("Initial quantity cannot be negative"),
  }),
);
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemInputSchema>;

export const recordInventoryMovementInputSchema = z.object({
  movement_type: z.enum(INVENTORY_MOVEMENT_TYPES),
  quantity: z.number().int("Quantity must be a whole number").positive("Quantity must be greater than zero"),
  reason: z.string().trim().nullable(),
  reference_type: z.string().trim().nullable(),
  reference_id: z.string().trim().nullable(),
});
export type RecordInventoryMovementInput = z.infer<typeof recordInventoryMovementInputSchema>;
