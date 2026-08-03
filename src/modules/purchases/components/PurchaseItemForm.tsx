"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { listInventoryItems, addPurchaseItem, updatePurchaseItem } from "@/lib/data";
import { majorToMinor, minorToMajor } from "@/lib/money";
import type { InventoryItem } from "@/types/inventoryItem";
import type { PurchaseItem } from "@/types/purchaseItem";

const positiveIntString = z
  .string()
  .trim()
  .refine((v) => /^[1-9]\d*$/.test(v), "Enter a whole number greater than zero");

const requiredMoneyString = z
  .string()
  .trim()
  .refine((v) => v !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0, "Enter a valid amount");

/**
 * Derived field-by-field from modules/purchases/schema.ts's
 * purchaseItemInputSchema — not a duplicate. `quantity_received`/
 * `line_subtotal_minor`/`display_order` are absent — all three are
 * assigned by the data layer (see that schema's own doc comment).
 */
const purchaseItemFormSchema = z.object({
  inventory_item_id: z.string().trim(),
  name: z.string().trim().min(1, "Name is required"),
  sku: z.string().trim(),
  quantity_ordered: positiveIntString,
  unit_cost_minor: requiredMoneyString,
});

export type PurchaseItemFormValues = z.infer<typeof purchaseItemFormSchema>;

interface PurchaseItemFormProps {
  purchaseId: string;
  /** null adds a new item; a PurchaseItem edits it in place. */
  item: PurchaseItem | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const emptyDefaults: PurchaseItemFormValues = {
  inventory_item_id: "",
  name: "",
  sku: "",
  quantity_ordered: "1",
  unit_cost_minor: "",
};

function itemToFormValues(item: PurchaseItem): PurchaseItemFormValues {
  return {
    inventory_item_id: item.inventory_item_id ?? "",
    name: item.name,
    sku: item.sku ?? "",
    quantity_ordered: String(item.quantity_ordered),
    unit_cost_minor: String(minorToMajor(item.unit_cost_minor)),
  };
}

export function PurchaseItemForm({ purchaseId, item, open, onClose, onSaved }: PurchaseItemFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[] | null>(null);
  const [inventoryError, setInventoryError] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseItemFormValues>({
    resolver: zodResolver(purchaseItemFormSchema),
    defaultValues: item ? itemToFormValues(item) : emptyDefaults,
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listInventoryItems({ includeArchived: false })
      .then((result) => {
        if (!cancelled) setInventoryItems(result);
      })
      .catch(() => {
        if (!cancelled) setInventoryError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleClose = () => {
    setFormError(null);
    reset(item ? itemToFormValues(item) : emptyDefaults);
    onClose();
  };

  /**
   * A one-time snapshot on selection — never re-synced afterward, matching
   * PurchaseItem's own doc comment ("sku is a point-in-time snapshot taken
   * from the linked Inventory item when the line is added... never a live
   * lookup"). A user's subsequent manual edits to name/sku/unit cost are
   * never overwritten by this; it only fires on the select's own change
   * event, not continuously.
   */
  const handleInventoryItemSelected = (inventoryItemId: string) => {
    if (!inventoryItemId || !inventoryItems) return;
    const selected = inventoryItems.find((candidate) => candidate.id === inventoryItemId);
    if (!selected) return;
    setValue("name", selected.name, { shouldDirty: true });
    setValue("sku", selected.sku ?? "", { shouldDirty: true });
    if (selected.unit_cost !== null) {
      setValue("unit_cost_minor", String(minorToMajor(selected.unit_cost)), { shouldDirty: true });
    }
  };

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const input = {
      inventory_item_id: values.inventory_item_id || null,
      name: values.name,
      sku: values.sku || null,
      quantity_ordered: Number(values.quantity_ordered),
      unit_cost_minor: majorToMinor(Number(values.unit_cost_minor)),
    };
    const result = item ? await updatePurchaseItem(item.id, input) : await addPurchaseItem(purchaseId, input);
    if (!result.success) {
      setFormError(result.error);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof PurchaseItemFormValues, { message });
        }
      }
      return;
    }
    onSaved();
  });

  return (
    <Modal open={open} onClose={handleClose} title={item ? "Edit Item" : "Add Item"}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {formError}
          </div>
        ) : null}

        <FormField
          label="Inventory item"
          htmlFor="inventory_item_id"
          hint="Optional — leave blank for a non-inventory line (a fee, rental, or service)"
        >
          <Select
            id="inventory_item_id"
            disabled={!inventoryItems}
            {...register("inventory_item_id", { onChange: (event) => handleInventoryItemSelected(event.target.value) })}
          >
            <option value="">{inventoryItems ? "No inventory item (custom line)" : "Loading inventory items…"}</option>
            {inventoryItems
              ?.filter((candidate) => {
                const q = inventorySearch.trim().toLowerCase();
                if (!q) return true;
                return `${candidate.name} ${candidate.sku ?? ""}`.toLowerCase().includes(q);
              })
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                  {candidate.sku ? ` (${candidate.sku})` : ""}
                </option>
              ))}
          </Select>
        </FormField>
        {inventoryItems && inventoryItems.length > 5 ? (
          <FormField label="Search inventory" htmlFor="inventory_search" hint="Filters the list above">
            <Input
              id="inventory_search"
              value={inventorySearch}
              onChange={(event) => setInventorySearch(event.target.value)}
              placeholder="Search by name or SKU…"
            />
          </FormField>
        ) : null}
        {inventoryError ? (
          <p role="alert" className="text-sm text-danger">
            Could not load inventory items. You can still add a non-inventory line.
          </p>
        ) : null}

        <FormField label="Name" htmlFor="item_name" required error={errors.name?.message}>
          <Input id="item_name" invalid={!!errors.name} {...register("name")} />
        </FormField>
        <FormField label="SKU" htmlFor="item_sku" hint="Snapshot — won't update if the linked item's SKU changes later" error={errors.sku?.message}>
          <Input id="item_sku" invalid={!!errors.sku} {...register("sku")} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Quantity ordered" htmlFor="quantity_ordered" required error={errors.quantity_ordered?.message}>
            <Input id="quantity_ordered" inputMode="numeric" invalid={!!errors.quantity_ordered} {...register("quantity_ordered")} />
          </FormField>
          <FormField label="Unit cost" htmlFor="unit_cost_minor" required hint="Major units, e.g. 12.50" error={errors.unit_cost_minor?.message}>
            <Input id="unit_cost_minor" type="number" min={0} step="0.01" invalid={!!errors.unit_cost_minor} {...register("unit_cost_minor")} />
          </FormField>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : item ? "Save changes" : "Add item"}
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
