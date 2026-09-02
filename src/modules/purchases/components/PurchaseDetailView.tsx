"use client";

import { useEffect, useState } from "react";
import { getPurchase, listPurchaseItems, getPurchaseReceiptSummary } from "@/lib/data";
import type { Purchase } from "@/types/purchase";
import type { PurchaseItem } from "@/types/purchaseItem";
import type { PurchaseReceiptSummary } from "@/lib/data/purchases/repository";
import { NotFoundError } from "@/core/errors";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatMoney, calculatePercentage } from "@/lib/money";
import { PurchaseStatusBadge } from "@/modules/purchases/components/PurchaseStatusBadge";
import { PurchaseActions } from "@/modules/purchases/components/PurchaseActions";
import { PurchaseItemsSection } from "@/modules/purchases/components/PurchaseItemsSection";
import { PurchaseVendorSection } from "@/modules/purchases/components/PurchaseVendorSection";
import { PurchaseNotesSection } from "@/modules/purchases/components/PurchaseNotesSection";
import { PurchaseTimelineSection } from "@/modules/purchases/components/PurchaseTimelineSection";
import { PurchaseDocumentsSection } from "@/modules/purchases/components/PurchaseDocumentsSection";
import { formatPurchaseDate } from "@/modules/purchases/mappers";
import { PurchaseAssignedEventsCard } from "@/modules/operations/components/PurchaseAssignedEventsCard";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; purchase: Purchase; items: PurchaseItem[]; receiptSummary: PurchaseReceiptSummary };

/**
 * Purchase + its items + the receipt summary are fetched together (not
 * independently, unlike Notes/Timeline/Documents below) because
 * PurchaseItemsSection and the Totals/Receipt-progress cards all need the
 * same item list — mirrors ContractDetailView fetching its Contract +
 * Exhibits together for the same reason.
 */
async function loadPurchaseDetail(purchaseId: string): Promise<LoadState> {
  try {
    const [purchase, items, receiptSummary] = await Promise.all([
      getPurchase(purchaseId),
      listPurchaseItems(purchaseId),
      getPurchaseReceiptSummary(purchaseId),
    ]);
    return { status: "ready", purchase, items, receiptSummary };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

export function PurchaseDetailView({ purchaseId }: { purchaseId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadPurchaseDetail(purchaseId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [purchaseId]);

  const refetch = () => {
    loadPurchaseDetail(purchaseId).then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This purchase could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this purchase." onRetry={refetch} />;
  }

  const { purchase, items, receiptSummary } = state;
  const receiptPercentage = calculatePercentage(receiptSummary.totalReceived, receiptSummary.totalOrdered);
  const remaining = receiptSummary.totalOrdered - receiptSummary.totalReceived;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-3xl font-semibold text-text">{purchase.purchase_number}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PurchaseStatusBadge status={purchase.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-text-muted">
          <PurchaseVendorSection vendorId={purchase.vendor_id} />
          <span>Ordered {formatPurchaseDate(purchase.order_date)}</span>
          <span>Expected {formatPurchaseDate(purchase.expected_delivery_date)}</span>
        </div>

        <div className="mt-4">
          <PurchaseActions purchase={purchase} onChanged={refetch} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div>
            <SectionHeader title="Overview" />
            <LuxuryCard>
              <h3 className="font-serif text-[17px] font-semibold text-text">Order details</h3>
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Vendor reference" value={purchase.vendor_reference} />
                <Field label="Currency" value={purchase.currency} />
                <Field label="Order date" value={formatPurchaseDate(purchase.order_date)} />
                <Field label="Expected delivery" value={formatPurchaseDate(purchase.expected_delivery_date)} />
                <Field label="Actual received date" value={formatPurchaseDate(purchase.actual_received_date)} />
              </dl>
            </LuxuryCard>
          </div>

          <div>
            <SectionHeader title="Totals" />
            <LuxuryCard tone="tint">
              <h3 className="font-serif text-[17px] font-semibold text-text">Totals</h3>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Subtotal" value={formatMoney(purchase.subtotal_minor, purchase.currency)} />
                <Field label="Tax" value={formatMoney(purchase.tax_minor, purchase.currency)} />
                <Field label="Shipping" value={formatMoney(purchase.shipping_minor, purchase.currency)} />
                <Field label="Discount" value={formatMoney(purchase.discount_minor, purchase.currency)} />
                <Field label="Total" value={formatMoney(purchase.total_minor, purchase.currency)} />
              </dl>
              <p className="mt-3 text-xs text-text-muted">
                Subtotal and total are always calculated from line items — they can&rsquo;t be edited directly.
              </p>
            </LuxuryCard>
          </div>

          <div>
            <SectionHeader title="Receipt Progress" />
            <LuxuryCard>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Ordered" value={String(receiptSummary.totalOrdered)} />
                <Field label="Received" value={String(receiptSummary.totalReceived)} />
                <Field label="Remaining" value={String(remaining)} />
                <Field label="Progress" value={`${receiptPercentage}%`} />
              </dl>
            </LuxuryCard>
          </div>

          <div>
            <SectionHeader title="Line Items" />
            <PurchaseItemsSection purchase={purchase} items={items} onChanged={refetch} />
          </div>

          <div>
            <SectionHeader title="Notes & Documents" />
            <div className="space-y-6">
              <LuxuryCard>
                <h3 className="font-serif text-[17px] font-semibold text-text">Notes</h3>
                <div className="mt-3">
                  <PurchaseNotesSection workspaceId={purchase.workspace_id} purchaseId={purchase.id} />
                </div>
              </LuxuryCard>

              <LuxuryCard>
                <h3 className="font-serif text-[17px] font-semibold text-text">Documents</h3>
                <div className="mt-3">
                  <PurchaseDocumentsSection purchaseId={purchase.id} />
                </div>
              </LuxuryCard>
            </div>
          </div>
        </div>

        <div>
          <SectionHeader title="At a glance" />
          <div className="space-y-6">
            <PurchaseAssignedEventsCard purchaseId={purchase.id} />

            <LuxuryCard>
              <h3 className="font-serif text-[17px] font-semibold text-text">Internal</h3>
              <dl className="mt-3 grid grid-cols-1 gap-3">
                <Field label="Notes" value={purchase.notes} />
                <Field label="Created by" value={purchase.created_by} />
                <Field label="Created" value={new Date(purchase.created_at).toLocaleDateString()} />
                <Field label="Updated" value={new Date(purchase.updated_at).toLocaleDateString()} />
                {purchase.archived_at ? <Field label="Archived" value={new Date(purchase.archived_at).toLocaleDateString()} /> : null}
              </dl>
            </LuxuryCard>

            <LuxuryCard>
              <h3 className="font-serif text-[17px] font-semibold text-text">Timeline</h3>
              <div className="mt-3">
                {/* Keyed on updated_at so editing/submitting/cancelling/
                    archiving/restoring/receiving remounts the section and it
                    re-fetches — every one of those mutations bumps
                    updated_at. */}
                <PurchaseTimelineSection key={purchase.updated_at} purchaseId={purchase.id} />
              </div>
            </LuxuryCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value || "—"}</dd>
    </div>
  );
}
