"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listInventoryItems } from "@/lib/data";
import type { InventoryItem } from "@/types/inventoryItem";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InventoryStatusBadge } from "@/modules/inventory/components/InventoryStatusBadge";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; items: InventoryItem[] };

async function loadVendorInventory(vendorId: string): Promise<LoadState> {
  try {
    const items = await listInventoryItems({ primaryVendorId: vendorId, includeArchived: true });
    return { status: "ready", items };
  } catch {
    return { status: "error" };
  }
}

/**
 * Fetches independently of VendorDetailView and its other sections — same
 * rationale as VendorNotesSection/VendorDocumentsSection: an Inventory-list
 * failure must never blank the rest of the Vendor page. The relationship is
 * one-directional (InventoryItem.primary_vendor_id → Vendor.id, no back-
 * reference stored on Vendor itself), so this is always a live query via
 * the existing `listInventoryItems` filter, never a stored array. Only
 * links out to each item's own detail page — Inventory detail is
 * deliberately not duplicated here.
 */
export function VendorInventorySection({ vendorId }: { vendorId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadVendorInventory(vendorId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const retry = () => {
    setState({ status: "loading" });
    loadVendorInventory(vendorId).then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-3" aria-live="polite" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load inventory items for this vendor." onRetry={retry} />;
  }

  const { items } = state;

  if (items.length === 0) {
    return <EmptyState title="No inventory items yet" description="Items sourced from this vendor will show up here." />;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Item</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">SKU</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Type</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Status</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">On hand</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Available</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-text/4">
              <td className="border-b border-border px-2.5 py-2">
                <Link href={`/inventory/${item.id}`} className="block max-w-[14rem] truncate font-medium text-text hover:text-accent">
                  {item.name}
                </Link>
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{item.sku ?? "—"}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{item.item_type === "consumable" ? "Consumable" : "Reusable"}</td>
              <td className="border-b border-border px-2.5 py-2">
                <InventoryStatusBadge status={item.status} />
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{item.quantity_on_hand}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{item.quantity_available}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
