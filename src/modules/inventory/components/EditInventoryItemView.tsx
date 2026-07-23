"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getInventoryItem, updateInventoryItem } from "@/lib/data";
import type { DataResult } from "@/lib/data/result";
import type { InventoryItem } from "@/types/inventoryItem";
import { NotFoundError } from "@/core/errors";
import { majorToMinor } from "@/lib/money";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { InventoryItemForm, type InventoryItemFormValues } from "@/modules/inventory/components/InventoryItemForm";
import { inventoryItemToFormInput } from "@/modules/inventory/mappers";

type LoadState = { status: "loading" } | { status: "not-found" } | { status: "error" } | { status: "ready"; item: InventoryItem };

export function EditInventoryItemView({ inventoryItemId }: { inventoryItemId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getInventoryItem(inventoryItemId)
      .then((item) => {
        if (!cancelled) setState({ status: "ready", item });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: err instanceof NotFoundError ? "not-found" : "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [inventoryItemId]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This inventory item could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this inventory item." />;
  }

  return (
    <div>
      <h2 className="text-3xl font-semibold text-text">Edit {state.item.name}</h2>
      <div className="mt-6 max-w-3xl">
        <InventoryItemForm
          submitLabel="Save changes"
          cancelHref={`/inventory/${inventoryItemId}`}
          defaultValues={inventoryItemToFormInput(state.item)}
          onSubmit={async (values: InventoryItemFormValues): Promise<DataResult<InventoryItem>> => {
            const result = await updateInventoryItem(inventoryItemId, {
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
              primary_vendor_id: state.item.primary_vendor_id,
              purchase_date: values.purchase_date || null,
              notes: values.notes || null,
              image_url: state.item.image_url,
            });
            if (!result.success) return result;

            router.push(`/inventory/${inventoryItemId}`);
            return result;
          }}
        />
      </div>
    </div>
  );
}
