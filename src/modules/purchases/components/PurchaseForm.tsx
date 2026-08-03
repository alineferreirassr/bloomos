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
import { getVendors } from "@/lib/data";
import type { DataResult } from "@/lib/data/result";
import type { Purchase } from "@/types/purchase";
import type { Vendor } from "@/types/vendor";

const moneyStringOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), "Enter a valid amount");

/**
 * Derived field-by-field from modules/purchases/schema.ts's
 * purchaseBaseSchema/createPurchaseInputSchema — not a duplicate.
 * `status`/`order_date`/`actual_received_date`/`subtotal_minor`/
 * `total_minor` are deliberately absent: every status transition goes
 * through its own dedicated repository method (submitPurchase/
 * cancelPurchase/archivePurchase/restorePurchase), and totals are always
 * recomputed by the repository from the current PurchaseItem set, never
 * caller-supplied — same "derived, not trusted from input" rule Invoice's
 * own total_minor follows.
 *
 * `vendor_id` is only ever rendered on the create form (mirrors
 * InvoiceForm's disableClientChange precedent) — Purchase's own vendor_id
 * is immutable after creation and has no field on purchaseInputSchema at
 * all, so the edit form never submits it. It stays in this shared type
 * (validated the same way on both forms) purely so one schema/type serves
 * both create and edit without a conditional schema; on edit it's supplied
 * from the existing record and rendered read-only, never user-editable.
 */
const purchaseFormSchema = z.object({
  vendor_id: z.string().trim().min(1, "Vendor is required"),
  expected_delivery_date: z.string().trim(),
  currency: z.string().trim().length(3, "Use a 3-letter currency code"),
  tax_minor: moneyStringOrEmpty,
  shipping_minor: moneyStringOrEmpty,
  discount_minor: moneyStringOrEmpty,
  notes: z.string().trim(),
  vendor_reference: z.string().trim(),
});

export type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;

interface PurchaseFormProps {
  mode: "create" | "edit";
  defaultValues?: Partial<PurchaseFormValues>;
  /** Only used in edit mode, to render the immutable Vendor as read-only text instead of a picker. */
  vendorLabel?: string;
  onSubmit: (values: PurchaseFormValues) => Promise<DataResult<Purchase>>;
  submitLabel: string;
  cancelHref: string;
}

const emptyDefaults: PurchaseFormValues = {
  vendor_id: "",
  expected_delivery_date: "",
  currency: "USD",
  tax_minor: "",
  shipping_minor: "",
  discount_minor: "",
  notes: "",
  vendor_reference: "",
};

export function PurchaseForm({ mode, defaultValues, vendorLabel, onSubmit, submitLabel, cancelHref }: PurchaseFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [vendorsError, setVendorsError] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });

  // Same fix InventoryItemForm/ExpenseForm/InvoiceForm apply for their
  // cascading selects: an uncontrolled <select>'s defaultValue is only
  // applied against whatever <option>s exist at mount. Vendors arrive after
  // mount, so a pre-selected vendor_id would silently revert to "" once the
  // fetch was the last thing to render — re-apply it explicitly once
  // options exist. Only relevant in create mode (edit never renders the
  // picker at all).
  useEffect(() => {
    if (mode === "create" && vendors && defaultValues?.vendor_id) {
      setValue("vendor_id", defaultValues.vendor_id, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendors]);

  useEffect(() => {
    if (mode !== "create") return;
    let cancelled = false;
    getVendors({ includeArchived: false })
      .then((result) => {
        if (!cancelled) setVendors(result);
      })
      .catch(() => {
        if (!cancelled) setVendorsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

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
          setError(field as keyof PurchaseFormValues, { message });
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
        <h3 className="text-sm font-semibold text-text">Vendor</h3>
        {mode === "create" ? (
          <>
            <p className="mt-1 text-xs text-text-muted">The supplier this order is placed with. Can&rsquo;t be changed after creation.</p>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Search vendors" htmlFor="vendor_search" hint="Filters the list below">
                <Input
                  id="vendor_search"
                  value={vendorSearch}
                  onChange={(event) => setVendorSearch(event.target.value)}
                  placeholder="Search by company or display name…"
                  disabled={!vendors}
                />
              </FormField>
              <FormField label="Vendor" htmlFor="vendor_id" required error={errors.vendor_id?.message}>
                <Select id="vendor_id" invalid={!!errors.vendor_id} disabled={!vendors} {...register("vendor_id")}>
                  <option value="">{vendors ? "Select a vendor…" : "Loading vendors…"}</option>
                  {vendors
                    ?.filter((vendor) => {
                      const q = vendorSearch.trim().toLowerCase();
                      if (!q) return true;
                      return `${vendor.company_name} ${vendor.display_name ?? ""}`.toLowerCase().includes(q);
                    })
                    .map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.company_name}
                        {vendor.display_name ? ` (${vendor.display_name})` : ""}
                      </option>
                    ))}
                </Select>
              </FormField>
            </div>
            {vendorsError ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                Could not load vendors. Reload the page to try again.
              </p>
            ) : vendors && vendors.length === 0 ? (
              <p className="mt-2 text-xs text-text-muted">No vendors exist yet — create one first.</p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-text">{vendorLabel ?? "—"}</p>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Order details</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Expected delivery date" htmlFor="expected_delivery_date" error={errors.expected_delivery_date?.message}>
            <Input id="expected_delivery_date" type="date" invalid={!!errors.expected_delivery_date} {...register("expected_delivery_date")} />
          </FormField>
          <FormField label="Currency" htmlFor="currency" required hint="3-letter code, e.g. USD" error={errors.currency?.message}>
            <Input id="currency" invalid={!!errors.currency} {...register("currency")} />
          </FormField>
          <FormField label="Vendor reference" htmlFor="vendor_reference" hint="The Vendor's own order/quote number" error={errors.vendor_reference?.message}>
            <Input id="vendor_reference" invalid={!!errors.vendor_reference} {...register("vendor_reference")} />
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Tax, shipping &amp; discount</h3>
        <p className="mt-1 text-xs text-text-muted">Major units (e.g. 12.50), converted to minor units before saving. Subtotal and total are always calculated from line items.</p>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Tax" htmlFor="tax_minor" error={errors.tax_minor?.message}>
            <Input id="tax_minor" type="number" min={0} step="0.01" invalid={!!errors.tax_minor} {...register("tax_minor")} />
          </FormField>
          <FormField label="Shipping" htmlFor="shipping_minor" error={errors.shipping_minor?.message}>
            <Input id="shipping_minor" type="number" min={0} step="0.01" invalid={!!errors.shipping_minor} {...register("shipping_minor")} />
          </FormField>
          <FormField label="Discount" htmlFor="discount_minor" error={errors.discount_minor?.message}>
            <Input id="discount_minor" type="number" min={0} step="0.01" invalid={!!errors.discount_minor} {...register("discount_minor")} />
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
