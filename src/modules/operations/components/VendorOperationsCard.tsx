"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { getVendorOperationsSummary, type VendorOperationsSummary } from "@/modules/operations/vendorOperationsData";

type LoadState = { status: "loading" } | { status: "ready"; summary: VendorOperationsSummary } | { status: "error" };

/** v2 Checkpoint 21, Step 7 — Assigned Events + Purchase History for one Vendor. Quietly renders nothing on error, matching the Assistant Card precedent. */
export function VendorOperationsCard({ vendorId }: { vendorId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getVendorOperationsSummary(vendorId).then(
      (summary) => {
        if (!cancelled) setState({ status: "ready", summary });
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  if (state.status === "loading") {
    return (
      <Card>
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  if (state.status === "error") return null;

  const { summary } = state;

  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Operations</h3>
      <div className="mt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Assigned Events</p>
        {summary.assignedEvents.length === 0 ? (
          <p className="mt-1.5 text-sm text-text-muted">No confirmed assignments to an active event.</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {summary.assignedEvents.map((event) => (
              <li key={event.id}>
                <Link href={`/events/${event.id}`} className="text-sm text-accent hover:underline">
                  {event.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Purchase History</p>
        {summary.purchaseHistory.length === 0 ? (
          <p className="mt-1.5 text-sm text-text-muted">No purchase orders with this vendor yet.</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {summary.purchaseHistory.slice(0, 5).map((purchase) => (
              <li key={purchase.id} className="flex items-center justify-between text-sm">
                <span className="text-text">{purchase.purchase_number}</span>
                <span className="text-text-muted">{purchase.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-4 text-xs text-text-muted">
        No vendor-linked Payments or Contracts, or a Rating field, exist in this codebase yet — Purchase History is the closest real proxy shown here.
      </p>
    </Card>
  );
}
