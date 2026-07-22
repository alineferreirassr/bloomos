"use client";

import { useRouter } from "next/navigation";
import { createVendor, setVendorPreferredStatus, setVendorStatus } from "@/lib/data";
import type { DataResult } from "@/lib/data/result";
import type { Vendor } from "@/types/vendor";
import { VendorForm, type VendorFormValues } from "@/modules/vendors/components/VendorForm";

export function NewVendorView() {
  const router = useRouter();

  return (
    <div>
      <h2 className="text-3xl font-semibold text-text">New Vendor</h2>
      <p className="mt-1 text-sm text-text-muted">Add a supplier Amoré Bloom purchases from or books through.</p>
      <div className="mt-6 max-w-3xl">
        <VendorForm
          submitLabel="Create Vendor"
          cancelHref="/vendors"
          onSubmit={async (values: VendorFormValues): Promise<DataResult<Vendor>> => {
            const result = await createVendor({
              company_name: values.company_name,
              display_name: values.display_name || null,
              contact_person: null,
              email: values.email || null,
              phone: values.phone || null,
              website: values.website || null,
              tax_id: values.tax_id || null,
              address: null,
              city: null,
              state: null,
              zip_code: null,
              country: null,
              notes: values.notes || null,
              tags: values.tags,
              default_currency: values.default_currency,
              payment_terms: null,
            });
            if (!result.success) return result;

            // status/is_preferred aren't part of CreateVendorInput — the
            // repository always creates active/not-preferred and exposes
            // dedicated methods for both, so follow up only if the user
            // picked a non-default value.
            let vendor = result.data;
            if (values.status !== vendor.status) {
              const statusResult = await setVendorStatus(vendor.id, values.status);
              if (statusResult.success) vendor = statusResult.data;
            }
            if (values.is_preferred !== vendor.is_preferred) {
              const preferredResult = await setVendorPreferredStatus(vendor.id, values.is_preferred);
              if (preferredResult.success) vendor = preferredResult.data;
            }

            router.push(`/vendors/${vendor.id}`);
            return { success: true, data: vendor };
          }}
        />
      </div>
    </div>
  );
}
