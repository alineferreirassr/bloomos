"use client";

import { useEffect, useState } from "react";
import { listPurchases, getOverduePurchases } from "@/lib/data";
import { computePurchaseSummary, type PurchaseSummary } from "@/modules/purchases/purchaseStats";
import { formatMoney } from "@/lib/money";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; summary: PurchaseSummary };

async function loadSummary(): Promise<LoadState> {
  try {
    const [allPurchases, overduePurchases] = await Promise.all([
      listPurchases({ includeArchived: true }),
      getOverduePurchases(),
    ]);
    return { status: "ready", summary: computePurchaseSummary(allPurchases, overduePurchases) };
  } catch {
    return { status: "error" };
  }
}

/**
 * Fetches independently of PurchasesListView's own filtered list fetch —
 * these counts reflect the whole workspace, not whatever filters happen to
 * be active, and a summary failure must never blank the list below it.
 * Mirrors InventorySummarySection exactly.
 */
export function PurchaseSummarySection() {
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
    return <ErrorState message="Could not load purchases summary." onRetry={retry} />;
  }

  const { summary } = state;
  const cards = [
    { label: "Open", value: String(summary.open) },
    { label: "Overdue", value: String(summary.overdue) },
    { label: "Partially received", value: String(summary.partiallyReceived) },
    { label: "Open value", value: formatMoney(summary.totalOpenValueMinor, "USD") },
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
