"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { TagsInput } from "@/modules/vendors/components/TagsInput";
import { VENDOR_STATUS_LABELS, VENDOR_STATUSES, type VendorStatus } from "@/core/enums/vendorStatus";
import { createVendorInputSchema } from "@/modules/vendors/schema";
import type { DataResult } from "@/lib/data/result";
import type { Vendor } from "@/types/vendor";

/**
 * Derived from the committed modules/vendors/schema.ts's createVendorInputSchema
 * — not a duplicate. `company_name`'s required-non-empty rule, `tags`'s shape,
 * and `default_currency`'s length-3-then-uppercase rule are picked straight
 * from the shared schema, unchanged. Only the fields whose repository shape
 * (`string | null`) doesn't match what an HTML input actually produces
 * (a plain `string`, never `null`) are overridden to plain `.string()` here —
 * a UI-only adaptation, not a re-declaration of validation rules. `status`
 * and `is_preferred` don't exist on the repository input schema at all (they
 * go through the dedicated setVendorStatus/setVendorPreferredStatus calls,
 * never createVendor/updateVendor — see modules/vendors/schema.ts's own
 * comment), so they're additively defined here for the form only.
 */
const vendorFormSchema = createVendorInputSchema
  .pick({ company_name: true, tags: true, default_currency: true })
  .extend({
    display_name: z.string().trim(),
    email: z.string().trim().refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address"),
    phone: z.string().trim(),
    website: z.string().trim(),
    tax_id: z.string().trim(),
    notes: z.string().trim(),
    is_preferred: z.boolean(),
    status: z.enum(VENDOR_STATUSES),
  });

export type VendorFormValues = z.infer<typeof vendorFormSchema>;

interface VendorFormProps {
  defaultValues?: Partial<VendorFormValues>;
  onSubmit: (input: VendorFormValues) => Promise<DataResult<Vendor>>;
  submitLabel: string;
  cancelHref: string;
}

const emptyDefaults: VendorFormValues = {
  company_name: "",
  display_name: "",
  email: "",
  phone: "",
  website: "",
  tax_id: "",
  default_currency: "USD",
  is_preferred: false,
  status: "active",
  tags: [],
  notes: "",
};

export function VendorForm({ defaultValues, onSubmit, submitLabel, cancelHref }: VendorFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });
  const tags = watch("tags");

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
          setError(field as keyof VendorFormValues, { message });
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
        <h3 className="text-sm font-semibold text-text">Company</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Company name" htmlFor="company_name" required error={errors.company_name?.message}>
            <Input id="company_name" invalid={!!errors.company_name} {...register("company_name")} />
          </FormField>
          <FormField label="Display name" htmlFor="display_name" error={errors.display_name?.message}>
            <Input id="display_name" invalid={!!errors.display_name} {...register("display_name")} />
          </FormField>
          <FormField label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" invalid={!!errors.email} {...register("email")} />
          </FormField>
          <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" invalid={!!errors.phone} {...register("phone")} />
          </FormField>
          <FormField label="Website" htmlFor="website" error={errors.website?.message}>
            <Input id="website" placeholder="https://…" invalid={!!errors.website} {...register("website")} />
          </FormField>
          <FormField label="Tax ID" htmlFor="tax_id" error={errors.tax_id?.message}>
            <Input id="tax_id" invalid={!!errors.tax_id} {...register("tax_id")} />
          </FormField>
          <FormField label="Currency" htmlFor="default_currency" error={errors.default_currency?.message}>
            <Input id="default_currency" maxLength={3} invalid={!!errors.default_currency} {...register("default_currency")} />
          </FormField>
          <FormField label="Status" htmlFor="status" error={errors.status?.message}>
            <Select id="status" invalid={!!errors.status} {...register("status")}>
              {VENDOR_STATUSES.map((status: VendorStatus) => (
                <option key={status} value={status}>
                  {VENDOR_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-text">
          <Checkbox {...register("is_preferred")} />
          Preferred vendor
        </label>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Tags</h3>
        <div className="mt-3">
          <TagsInput tags={tags} onChange={(next) => setValue("tags", next, { shouldDirty: true })} disabled={isSubmitting} />
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
