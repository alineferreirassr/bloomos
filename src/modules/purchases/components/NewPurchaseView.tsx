"use client";

import { useRouter } from "next/navigation";
import { createPurchase } from "@/lib/data";
import type { DataResult } from "@/lib/data/result";
import type { Purchase } from "@/types/purchase";
import { majorToMinor } from "@/lib/money";
import { PurchaseForm, type PurchaseFormValues } from "@/modules/purchases/components/PurchaseForm";

export function NewPurchaseView() {
  const router = useRouter();

  return (
    <div>
      <h2 className="font-serif text-3xl font-semibold text-text">New Purchase</h2>
      <p className="mt-1 text-sm text-text-muted">Create a draft purchase order — add line items and submit it once it&rsquo;s ready.</p>
      <div className="mt-6 max-w-3xl">
        <PurchaseForm
          mode="create"
          submitLabel="Create Purchase"
          cancelHref="/purchases"
          onSubmit={async (values: PurchaseFormValues): Promise<DataResult<Purchase>> => {
            const result = await createPurchase({
              vendor_id: values.vendor_id,
              expected_delivery_date: values.expected_delivery_date || null,
              currency: values.currency,
              tax_minor: values.tax_minor === "" ? 0 : majorToMinor(Number(values.tax_minor)),
              shipping_minor: values.shipping_minor === "" ? 0 : majorToMinor(Number(values.shipping_minor)),
              discount_minor: values.discount_minor === "" ? 0 : majorToMinor(Number(values.discount_minor)),
              notes: values.notes || null,
              vendor_reference: values.vendor_reference || null,
            });
            if (!result.success) return result;

            router.push(`/purchases/${result.data.id}`);
            return result;
          }}
        />
      </div>
    </div>
  );
}
