"use client";

import { useRouter } from "next/navigation";
import { createInventoryItem } from "@/lib/data";
import type { DataResult } from "@/lib/data/result";
import type { InventoryItem } from "@/types/inventoryItem";
import { majorToMinor } from "@/lib/money";
import { InventoryItemForm, type InventoryItemFormValues } from "@/modules/inventory/components/InventoryItemForm";

export function NewInventoryItemView() {
  const router = useRouter();

  return (
    <div>
      <h2 className="text-3xl font-semibold text-text">New Inventory Item</h2>
      <p className="mt-1 text-sm text-text-muted">Add a consumable or reusable item Amoré Bloom stocks for Events.</p>
      <div className="mt-6 max-w-3xl">
        <InventoryItemForm
          submitLabel="Create Item"
          cancelHref="/inventory"
          showInitialQuantity
          onSubmit={async (values: InventoryItemFormValues): Promise<DataResult<InventoryItem>> => {
            const result = await createInventoryItem({
              name: values.name,
              description: values.description || null,
              sku: values.sku || null,
              category: values.category || null,
              subcategory: values.subcategory || null,
              item_type: values.item_type,
              status: values.status,
              tags: values.tags,
              condition: values.condition === "" ? null : values.condition,
              unit_of_measure: values.unit_of_measure || null,
              reorder_level: values.reorder_level === "" ? null : Number(values.reorder_level),
              target_stock_level: values.target_stock_level === "" ? null : Number(values.target_stock_level),
              unit_cost: values.unit_cost === "" ? null : majorToMinor(Number(values.unit_cost)),
              replacement_cost: values.replacement_cost === "" ? null : majorToMinor(Number(values.replacement_cost)),
              rental_value: values.rental_value === "" ? null : majorToMinor(Number(values.rental_value)),
              storage_location: values.storage_location || null,
              bin_location: values.bin_location || null,
              primary_vendor_id: values.primary_vendor_id || null,
              purchase_date: values.purchase_date || null,
              notes: values.notes || null,
              image_url: null,
              initial_quantity: Number(values.initial_quantity || "0"),
            });
            if (!result.success) return result;

            router.push(`/inventory/${result.data.id}`);
            return result;
          }}
        />
      </div>
    </div>
  );
}
