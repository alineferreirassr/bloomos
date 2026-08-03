"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getVendorById, setVendorPreferredStatus, setVendorStatus, updateVendor } from "@/lib/data";
import type { DataResult } from "@/lib/data/result";
import type { Vendor } from "@/types/vendor";
import { NotFoundError } from "@/core/errors";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { VendorForm, type VendorFormValues } from "@/modules/vendors/components/VendorForm";
import { vendorToFormInput } from "@/modules/vendors/mappers";

type LoadState = { status: "loading" } | { status: "not-found" } | { status: "error" } | { status: "ready"; vendor: Vendor };

export function EditVendorView({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getVendorById(vendorId)
      .then((vendor) => {
        if (!cancelled) setState({ status: "ready", vendor });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: err instanceof NotFoundError ? "not-found" : "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This vendor could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this vendor." />;
  }

  return (
    <div>
      <h2 className="text-3xl font-semibold text-text">Edit {state.vendor.company_name}</h2>
      <div className="mt-6 max-w-3xl">
        <VendorForm
          submitLabel="Save changes"
          cancelHref={`/vendors/${vendorId}`}
          defaultValues={vendorToFormInput(state.vendor)}
          onSubmit={async (values: VendorFormValues): Promise<DataResult<Vendor>> => {
            const result = await updateVendor(vendorId, {
              company_name: values.company_name,
              display_name: values.display_name || null,
              email: values.email || null,
              phone: values.phone || null,
              website: values.website || null,
              tax_id: values.tax_id || null,
              notes: values.notes || null,
              tags: values.tags,
              default_currency: values.default_currency,
            });
            if (!result.success) return result;

            let vendor = result.data;
            if (values.status !== vendor.status) {
              const statusResult = await setVendorStatus(vendor.id, values.status);
              if (statusResult.success) vendor = statusResult.data;
            }
            if (values.is_preferred !== vendor.is_preferred) {
              const preferredResult = await setVendorPreferredStatus(vendor.id, values.is_preferred);
              if (preferredResult.success) vendor = preferredResult.data;
            }

            router.push(`/vendors/${vendorId}`);
            return { success: true, data: vendor };
          }}
        />
      </div>
    </div>
  );
}
