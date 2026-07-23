"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listInventoryItems } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { InventoryItem } from "@/types/inventoryItem";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InventoryFilters, DEFAULT_INVENTORY_FILTERS, type InventoryFiltersValue } from "@/modules/inventory/components/InventoryFilters";
import { InventoryListTable } from "@/modules/inventory/components/InventoryListTable";
import { InventoryListCards } from "@/modules/inventory/components/InventoryListCards";
import { InventorySummarySection } from "@/modules/inventory/components/InventorySummarySection";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; items: InventoryItem[] };

async function loadInventoryFor(filters: InventoryFiltersValue): Promise<LoadState> {
  try {
    const items = await listInventoryItems({
      search: filters.search,
      status: filters.status,
      itemType: filters.itemType,
      condition: filters.condition,
      includeArchived: filters.includeArchived,
    });
    return { status: "ready", items };
  } catch {
    return { status: "error" };
  }
}

export function InventoryListView() {
  const [filters, setFilters] = useState<InventoryFiltersValue>(DEFAULT_INVENTORY_FILTERS);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // Same rationale as every other List view in the app: fetch once on
  // mount, then only ever refetch in direct response to a user action
  // (filter change, retry, or a row-level create/archive/restore).
  useEffect(() => {
    let cancelled = false;
    loadInventoryFor(DEFAULT_INVENTORY_FILTERS).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiltersChange = (next: InventoryFiltersValue) => {
    setFilters(next);
    setState({ status: "loading" });
    loadInventoryFor(next).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadInventoryFor(filters).then(setState);
  };

  const refetch = () => {
    loadInventoryFor(filters).then(setState);
  };

  const hasActiveFilters =
    filters.search !== "" || filters.status !== "all" || filters.itemType !== "all" || filters.condition !== "all";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-text">Inventory</h2>
          <p className="mt-1 text-sm text-text-muted">
            Consumable and reusable items Amoré Bloom stocks for Events. {getDataPersistenceMessage()}
          </p>
        </div>
        <Link href="/inventory/new">
          <Button type="button">New Item</Button>
        </Link>
      </div>

      <div className="mt-6">
        <InventorySummarySection />
      </div>

      <div className="mt-6">
        <InventoryFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3" aria-live="polite" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message="Could not load inventory items." onRetry={retry} />
        ) : state.items.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No items match these filters" : "No inventory items yet"}
            description={hasActiveFilters ? "Try adjusting or clearing your filters." : "Items you add will show up here."}
            action={
              !hasActiveFilters ? (
                <Link href="/inventory/new">
                  <Button type="button">New Item</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <InventoryListTable items={state.items} onChanged={refetch} />
            <InventoryListCards items={state.items} onChanged={refetch} />
          </>
        )}
      </div>
    </div>
  );
}
