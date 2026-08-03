"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getVendorById } from "@/lib/data";
import type { Vendor } from "@/types/vendor";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { VendorStatusBadge } from "@/modules/vendors/components/VendorStatusBadge";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; vendor: Vendor };

async function loadVendor(vendorId: string): Promise<LoadState> {
  try {
    const vendor = await getVendorById(vendorId);
    return { status: "ready", vendor };
  } catch {
    return { status: "error" };
  }
}

/**
 * Fetches independently of PurchaseDetailView's own fetch and every other
 * detail-page section — same rationale as Notes/Timeline/Documents: a
 * Vendor-lookup failure must never blank the rest of the Purchase page.
 * Unlike InventoryItemVendorSection, Purchase.vendor_id is never null (a
 * Purchase always has a Vendor), so there's no "no vendor assigned" branch.
 * Only displays identity fields already shown on VendorDetailView — the
 * link is the way to see everything else, never duplicating Vendor data.
 */
export function PurchaseVendorSection({ vendorId }: { vendorId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadVendor(vendorId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  if (state.status === "loading") {
    return <Skeleton className="h-10 w-full" />;
  }

  if (state.status === "error") {
    return (
      <ErrorState
        message="Could not load the linked vendor."
        onRetry={() => {
          setState({ status: "loading" });
          loadVendor(vendorId).then(setState);
        }}
      />
    );
  }

  const { vendor } = state;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Link href={`/vendors/${vendor.id}`} className="font-medium text-text hover:text-accent">
          {vendor.company_name}
        </Link>
        {vendor.display_name ? <p className="mt-0.5 text-xs text-text-muted">{vendor.display_name}</p> : null}
      </div>
      <VendorStatusBadge status={vendor.status} />
    </div>
  );
}
