import type { InventoryItem } from "@/types/inventoryItem";
import type { InventoryItemFormValues } from "@/modules/inventory/components/InventoryItemForm";
import { minorToMajor } from "@/lib/money";
import { formatDateOnly } from "@/lib/dateFormat";

/** Converts an InventoryItem record's null/numeric fields into the plain-string shape the form works with — mirrors vendorToFormInput. */
export function inventoryItemToFormInput(item: InventoryItem): InventoryItemFormValues {
  return {
    name: item.name,
    description: item.description ?? "",
    sku: item.sku ?? "",
    category: item.category ?? "",
    subcategory: item.subcategory ?? "",
    item_type: item.item_type,
    status: item.status === "archived" ? "active" : item.status,
    tags: item.tags,
    condition: item.condition ?? "",
    unit_of_measure: item.unit_of_measure ?? "",
    reorder_level: item.reorder_level === null ? "" : String(item.reorder_level),
    target_stock_level: item.target_stock_level === null ? "" : String(item.target_stock_level),
    unit_cost: item.unit_cost === null ? "" : String(minorToMajor(item.unit_cost)),
    replacement_cost: item.replacement_cost === null ? "" : String(minorToMajor(item.replacement_cost)),
    rental_value: item.rental_value === null ? "" : String(minorToMajor(item.rental_value)),
    storage_location: item.storage_location ?? "",
    bin_location: item.bin_location ?? "",
    primary_vendor_id: item.primary_vendor_id ?? "",
    purchase_date: item.purchase_date ?? "",
    notes: item.notes ?? "",
    initial_quantity: "0",
  };
}

/** Re-exported under this module's name so existing `formatInventoryDate` imports don't need to change — see `@/lib/dateFormat` for the shared implementation. */
export const formatInventoryDate = formatDateOnly;
