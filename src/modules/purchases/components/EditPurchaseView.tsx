"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPurchase, getVendorById, updatePurchase } from "@/lib/data";
import type { DataResult } from "@/lib/data/result";
import type { Purchase } from "@/types/purchase";
import { NotFoundError } from "@/core/errors";
import { majorToMinor } from "@/lib/money";
import { canEditPurchase } from "@/core/workflows/purchaseWorkflow";
import { PURCHASE_STATUS_LABELS } from "@/core/enums/purchaseStatus";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { PurchaseForm, type PurchaseFormValues } from "@/modules/purchases/components/PurchaseForm";
import { purchaseToFormInput } from "@/modules/purchases/mappers";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; purchase: Purchase; vendorLabel: string };

async function loadForEdit(purchaseId: string): Promise<LoadState> {
  try {
    const purchase = await getPurchase(purchaseId);
    const vendor = await getVendorById(purchase.vendor_id).catch(() => null);
    return { status: "ready", purchase, vendorLabel: vendor?.company_name ?? "Unknown vendor" };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

export function EditPurchaseView({ purchaseId }: { purchaseId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadForEdit(purchaseId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [purchaseId]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This purchase could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this purchase." />;
  }

  const { purchase, vendorLabel } = state;

  if (!canEditPurchase(purchase.status)) {
    return (
      <div>
        <h2 className="text-3xl font-semibold text-text">Edit {purchase.purchase_number}</h2>
        <p className="mt-4 text-sm text-text-muted">
          This purchase is {PURCHASE_STATUS_LABELS[purchase.status].toLowerCase()} and can&apos;t be edited.
        </p>
        <Link href={`/purchases/${purchaseId}`} className="mt-4 inline-block text-sm text-accent hover:underline">
          ← Back to purchase
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-semibold text-text">Edit {purchase.purchase_number}</h2>
      <div className="mt-6 max-w-3xl">
        <PurchaseForm
          mode="edit"
          submitLabel="Save changes"
          cancelHref={`/purchases/${purchaseId}`}
          defaultValues={purchaseToFormInput(purchase)}
          vendorLabel={vendorLabel}
          onSubmit={async (values: PurchaseFormValues): Promise<DataResult<Purchase>> => {
            const result = await updatePurchase(purchaseId, {
              expected_delivery_date: values.expected_delivery_date || null,
              currency: values.currency,
              tax_minor: values.tax_minor === "" ? 0 : majorToMinor(Number(values.tax_minor)),
              shipping_minor: values.shipping_minor === "" ? 0 : majorToMinor(Number(values.shipping_minor)),
              discount_minor: values.discount_minor === "" ? 0 : majorToMinor(Number(values.discount_minor)),
              notes: values.notes || null,
              vendor_reference: values.vendor_reference || null,
            });
            if (!result.success) return result;

            router.push(`/purchases/${purchaseId}`);
            return result;
          }}
        />
      </div>
    </div>
  );
}
