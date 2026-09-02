"use client";

import { useEffect, useState } from "react";
import { listInventoryItems, getLowStockInventoryItems, getDamagedOrUnderRepairInventoryItems } from "@/lib/data";
import { computeInventorySummary, type InventorySummary } from "@/modules/inventory/inventoryStats";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; summary: InventorySummary };

async function loadSummary(): Promise<LoadState> {
  try {
    const [allItems, lowStockItems, damagedOrUnderRepairItems] = await Promise.all([
      listInventoryItems({ includeArchived: true }),
      getLowStockInventoryItems(),
      getDamagedOrUnderRepairInventoryItems(),
    ]);
    return { status: "ready", summary: computeInventorySummary(allItems, lowStockItems, damagedOrUnderRepairItems) };
  } catch {
    return { status: "error" };
  }
}

/**
 * Fetches independently of InventoryListView's own filtered list fetch — the
 * counts here reflect the whole workspace, not whatever filters happen to
 * be active, and a summary failure must never blank the list below it.
 */
export function InventorySummarySection() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadSummary().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = () => {
    setState({ status: "loading" });
    loadSummary().then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-live="polite" aria-busy="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load inventory summary." onRetry={retry} />;
  }

  const { summary } = state;
  const cards = [
    { label: "Active items", value: summary.active },
    { label: "Low stock", value: summary.lowStock },
    { label: "Damaged / under repair", value: summary.damagedOrUnderRepair },
    { label: "Archived", value: summary.archived },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <LuxuryCard key={card.label}>
          <p className="text-xs text-text-muted">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold text-text">{card.value}</p>
        </LuxuryCard>
      ))}
    </div>
  );
}
