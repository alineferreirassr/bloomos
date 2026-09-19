"use client";

import { useRouter } from "next/navigation";
import { createPurchase } from "@/lib/data";
import type { DataResult } from "@/lib/data/result";
import type { Purchase } from "@/types/purchase";
import { majorToMinor } from "@/lib/money";
import { PageHeader } from "@/components/ui/PageHeader";
import { PurchaseForm, type PurchaseFormValues } from "@/modules/purchases/components/PurchaseForm";

export function NewPurchaseView() {
  const router = useRouter();

  return (
    // GLOBAL-VISUAL-06 (Business) — same AF-ported detail/form pattern as
    // NewLeadView/NewEventView.
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Purchase"
        title="New Purchase"
        subtitle="Create a draft purchase order — add line items and submit it once it's ready."
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Purchases", href: "/purchases" }, { label: "New" }]}
      />
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
