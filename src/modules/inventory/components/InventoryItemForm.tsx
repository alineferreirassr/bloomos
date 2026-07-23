"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { TagsInput } from "@/modules/vendors/components/TagsInput";
import { INVENTORY_ITEM_TYPE_LABELS, INVENTORY_ITEM_TYPES, type InventoryItemType } from "@/core/enums/inventoryItemType";
import { INVENTORY_CONDITION_LABELS, INVENTORY_CONDITIONS, type InventoryCondition } from "@/core/enums/inventoryCondition";
import type { DataResult } from "@/lib/data/result";
import type { InventoryItem } from "@/types/inventoryItem";

const nonNegativeIntStringOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d+$/.test(v), "Enter a whole, non-negative number");

const moneyStringOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), "Enter a valid amount");

/**
 * Derived field-by-field from modules/inventory/schema.ts's
 * inventoryItemBaseSchema — not a duplicate. Nullable numeric/date fields
 * become plain strings here (an HTML input can't produce `null`), matching
 * ExpenseForm/InvoiceForm's "amount" convention: validated as a string,
 * converted to its real type (Number/majorToMinor/null-if-empty) by the
 * calling View just before hitting the repository. `condition` uses `""` to
 * mean "not applicable" instead of `null` for the same reason.
 *
 * Quantity fields (quantity_on_hand/available/reserved) are deliberately
 * absent — they're movement-controlled only, never edited through this
 * form, matching the repository contract's own invariant.
 * `primary_vendor_id`/`image_url` are also absent: no Vendor integration
 * exists yet this phase, and image upload isn't part of this checkpoint —
 * both are submitted as `null` by the calling View.
 */
const inventoryItemFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    description: z.string().trim(),
    sku: z.string().trim(),
    category: z.string().trim(),
    subcategory: z.string().trim(),
    item_type: z.enum(INVENTORY_ITEM_TYPES),
    status: z.enum(["active", "inactive"] as const),
    tags: z.array(z.string()),
    condition: z.union([z.enum(INVENTORY_CONDITIONS), z.literal("")]),
    unit_of_measure: z.string().trim(),
    reorder_level: nonNegativeIntStringOrEmpty,
    target_stock_level: nonNegativeIntStringOrEmpty,
    unit_cost: moneyStringOrEmpty,
    replacement_cost: moneyStringOrEmpty,
    rental_value: moneyStringOrEmpty,
    storage_location: z.string().trim(),
    bin_location: z.string().trim(),
    purchase_date: z.string().trim(),
    notes: z.string().trim(),
    initial_quantity: nonNegativeIntStringOrEmpty,
  })
  .refine((data) => data.item_type !== "consumable" || data.condition === "", {
    message: "A consumable item cannot have a physical condition.",
    path: ["condition"],
  });

export type InventoryItemFormValues = z.infer<typeof inventoryItemFormSchema>;

interface InventoryItemFormProps {
  defaultValues?: Partial<InventoryItemFormValues>;
  onSubmit: (input: InventoryItemFormValues) => Promise<DataResult<InventoryItem>>;
  submitLabel: string;
  cancelHref: string;
  /** Only the create form collects initial stock — an existing item's quantities are movement-controlled from then on. */
  showInitialQuantity?: boolean;
}

const emptyDefaults: InventoryItemFormValues = {
  name: "",
  description: "",
  sku: "",
  category: "",
  subcategory: "",
  item_type: "consumable",
  status: "active",
  tags: [],
  condition: "",
  unit_of_measure: "",
  reorder_level: "",
  target_stock_level: "",
  unit_cost: "",
  replacement_cost: "",
  rental_value: "",
  storage_location: "",
  bin_location: "",
  purchase_date: "",
  notes: "",
  initial_quantity: "0",
};

export function InventoryItemForm({ defaultValues, onSubmit, submitLabel, cancelHref, showInitialQuantity }: InventoryItemFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<InventoryItemFormValues>({
    resolver: zodResolver(inventoryItemFormSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });
  const tags = watch("tags");
  const itemType = watch("item_type") as InventoryItemType;

  useEffect(() => {
    if (itemType === "consumable") {
      setValue("condition", "", { shouldDirty: false });
    }
  }, [itemType, setValue]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleCancel = () => {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    router.push(cancelHref);
  };

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await onSubmit(values);
    if (!result.success) {
      setFormError(result.error);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof InventoryItemFormValues, { message });
        }
      }
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {formError ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {formError}
        </div>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold text-text">Identity</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Name" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" invalid={!!errors.name} {...register("name")} />
          </FormField>
          <FormField label="SKU" htmlFor="sku" error={errors.sku?.message}>
            <Input id="sku" invalid={!!errors.sku} {...register("sku")} />
          </FormField>
          <FormField label="Category" htmlFor="category" error={errors.category?.message}>
            <Input id="category" invalid={!!errors.category} {...register("category")} />
          </FormField>
          <FormField label="Subcategory" htmlFor="subcategory" error={errors.subcategory?.message}>
            <Input id="subcategory" invalid={!!errors.subcategory} {...register("subcategory")} />
          </FormField>
        </div>
        <div className="mt-4">
          <FormField label="Description" htmlFor="description" error={errors.description?.message}>
            <Textarea id="description" rows={2} invalid={!!errors.description} {...register("description")} />
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Classification</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Item type" htmlFor="item_type" required error={errors.item_type?.message}>
            <Select id="item_type" invalid={!!errors.item_type} {...register("item_type")}>
              {INVENTORY_ITEM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {INVENTORY_ITEM_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Status" htmlFor="status" error={errors.status?.message}>
            <Select id="status" invalid={!!errors.status} {...register("status")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FormField>
          <FormField
            label="Condition"
            htmlFor="condition"
            error={errors.condition?.message}
            hint={itemType === "consumable" ? "Not applicable for consumable items" : undefined}
          >
            <Select id="condition" invalid={!!errors.condition} disabled={itemType === "consumable"} {...register("condition")}>
              <option value="">Not assessed</option>
              {INVENTORY_CONDITIONS.map((condition: InventoryCondition) => (
                <option key={condition} value={condition}>
                  {INVENTORY_CONDITION_LABELS[condition]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Unit of measure" htmlFor="unit_of_measure" hint='e.g. "stem", "each", "box of 12"' error={errors.unit_of_measure?.message}>
            <Input id="unit_of_measure" invalid={!!errors.unit_of_measure} {...register("unit_of_measure")} />
          </FormField>
        </div>
        <div className="mt-4">
          <TagsInput tags={tags} onChange={(next) => setValue("tags", next, { shouldDirty: true })} disabled={isSubmitting} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Stock thresholds</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {showInitialQuantity ? (
            <FormField label="Initial quantity" htmlFor="initial_quantity" hint="Recorded as an initial stock movement" error={errors.initial_quantity?.message}>
              <Input id="initial_quantity" inputMode="numeric" invalid={!!errors.initial_quantity} {...register("initial_quantity")} />
            </FormField>
          ) : null}
          <FormField label="Reorder level" htmlFor="reorder_level" hint="Flagged as low stock at or below this" error={errors.reorder_level?.message}>
            <Input id="reorder_level" inputMode="numeric" invalid={!!errors.reorder_level} {...register("reorder_level")} />
          </FormField>
          <FormField label="Target stock level" htmlFor="target_stock_level" error={errors.target_stock_level?.message}>
            <Input id="target_stock_level" inputMode="numeric" invalid={!!errors.target_stock_level} {...register("target_stock_level")} />
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Storage</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Storage location" htmlFor="storage_location" error={errors.storage_location?.message}>
            <Input id="storage_location" invalid={!!errors.storage_location} {...register("storage_location")} />
          </FormField>
          <FormField label="Bin location" htmlFor="bin_location" error={errors.bin_location?.message}>
            <Input id="bin_location" invalid={!!errors.bin_location} {...register("bin_location")} />
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Purchase &amp; value</h3>
        <p className="mt-1 text-xs text-text-muted">Major units (e.g. 12.50), converted to minor units before saving.</p>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Unit cost" htmlFor="unit_cost" error={errors.unit_cost?.message}>
            <Input id="unit_cost" type="number" min={0} step="0.01" invalid={!!errors.unit_cost} {...register("unit_cost")} />
          </FormField>
          <FormField label="Replacement cost" htmlFor="replacement_cost" error={errors.replacement_cost?.message}>
            <Input id="replacement_cost" type="number" min={0} step="0.01" invalid={!!errors.replacement_cost} {...register("replacement_cost")} />
          </FormField>
          <FormField label="Rental value" htmlFor="rental_value" error={errors.rental_value?.message}>
            <Input id="rental_value" type="number" min={0} step="0.01" invalid={!!errors.rental_value} {...register("rental_value")} />
          </FormField>
          <FormField label="Purchase date" htmlFor="purchase_date" error={errors.purchase_date?.message}>
            <Input id="purchase_date" type="date" invalid={!!errors.purchase_date} {...register("purchase_date")} />
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Notes</h3>
        <div className="mt-3">
          <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
            <Textarea id="notes" rows={3} invalid={!!errors.notes} {...register("notes")} />
          </FormField>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
