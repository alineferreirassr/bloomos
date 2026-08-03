"use client";

import { useEffect, useState } from "react";
import { listInventoryMovements } from "@/lib/data";
import type { InventoryMovement } from "@/types/inventoryMovement";
import { INVENTORY_MOVEMENT_TYPE_LABELS } from "@/core/enums/inventoryMovementType";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; movements: InventoryMovement[] };

async function loadMovements(inventoryItemId: string): Promise<LoadState> {
  try {
    const movements = await listInventoryMovements(inventoryItemId);
    return { status: "ready", movements };
  } catch {
    return { status: "error" };
  }
}

/**
 * Read-only — no edit or delete action, matching the repository contract's
 * own append-only invariant (there is no updateInventoryMovement/
 * deleteInventoryMovement anywhere in the stack). Fetches independently of
 * the rest of the item page, same rationale as every other detail-page
 * section here.
 */
export function InventoryMovementHistorySection({ inventoryItemId }: { inventoryItemId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadMovements(inventoryItemId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [inventoryItemId]);

  const retry = () => {
    setState({ status: "loading" });
    loadMovements(inventoryItemId).then(setState);
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
    return <ErrorState message="Could not load this item's movement history." onRetry={retry} />;
  }

  const { movements } = state;

  if (movements.length === 0) {
    return <EmptyState title="No movements yet" description="Stock movements recorded for this item will show up here." />;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">When</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Type</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Qty</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Before → After</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Reason</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">Reference</th>
            <th className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase">By</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {new Date(movement.occurred_at).toLocaleString()}
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text">{INVENTORY_MOVEMENT_TYPE_LABELS[movement.movement_type]}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{movement.quantity}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">
                {movement.quantity_before} → {movement.quantity_after}
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{movement.reason ?? "—"}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">
                {movement.reference_type ? `${movement.reference_type}${movement.reference_id ? ` · ${movement.reference_id}` : ""}` : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{movement.performed_by}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
