"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listInventoryItems } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { InventoryItem } from "@/types/inventoryItem";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { ModuleInsightCard } from "@/components/ui/ModuleInsightCard";
import { InventoryIcon, PurchasesIcon, CloseIcon } from "@/components/ui/icons";
import { InventoryFilters, DEFAULT_INVENTORY_FILTERS, type InventoryFiltersValue } from "@/modules/inventory/components/InventoryFilters";
import { InventoryListTable } from "@/modules/inventory/components/InventoryListTable";
import { InventoryListCards } from "@/modules/inventory/components/InventoryListCards";
import { InventorySummarySection } from "@/modules/inventory/components/InventorySummarySection";
import { isInventoryItemLowStock } from "@/modules/inventory/inventoryStats";
import { useSetCopilotPageContext } from "@/modules/ai/copilot/CopilotPageContextProvider";
import { InventoryAssistantCard } from "@/modules/ai/copilot/assistants/InventoryAssistantCard";

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
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [retryToken, setRetryToken] = useState(0);
  useSetCopilotPageContext({ module: "inventory", entity: null });

  // Fetch once on mount, then refetch whenever the debounced filters change
  // (so a search keystroke doesn't trigger a request until typing pauses)
  // or the user hits retry. Row-level create/archive/restore refetch
  // directly via `refetch` below, bypassing the debounce.
  useEffect(() => {
    let cancelled = false;
    loadInventoryFor(debouncedFilters).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, retryToken]);

  const handleFiltersChange = (next: InventoryFiltersValue) => {
    setFilters(next);
    setState({ status: "loading" });
  };

  const retry = () => {
    setState({ status: "loading" });
    setRetryToken((token) => token + 1);
  };

  const refetch = () => {
    loadInventoryFor(filters).then(setState);
  };

  const hasActiveFilters =
    filters.search !== "" || filters.status !== "all" || filters.itemType !== "all" || filters.condition !== "all";

  const kpis =
    state.status === "ready"
      ? {
          total: state.items.length,
          lowStock: state.items.filter(isInventoryItemLowStock).length,
          outOfStock: state.items.filter((item) => item.quantity_available === 0).length,
        }
      : null;

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle={`Consumable and reusable items Amoré Bloom stocks for Events. ${getDataPersistenceMessage()}`}
        actions={
          <Link href="/inventory/new">
            <Button type="button">New Item</Button>
          </Link>
        }
      />

      {kpis ? (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard icon={InventoryIcon} label="Total Items" value={kpis.total.toLocaleString()} />
          <KpiCard icon={PurchasesIcon} label="Low Stock" value={kpis.lowStock.toLocaleString()} />
          <KpiCard icon={CloseIcon} label="Out of Stock" value={kpis.outOfStock.toLocaleString()} />
        </div>
      ) : null}

      {kpis && (kpis.lowStock > 0 || kpis.outOfStock > 0) ? (
        <div className="mb-6">
          <ModuleInsightCard
            tone={kpis.outOfStock > 0 ? "warning" : "info"}
            insight={
              kpis.outOfStock > 0
                ? `${kpis.outOfStock} item${kpis.outOfStock === 1 ? " is" : "s are"} out of stock — ${kpis.lowStock} more running low.`
                : `${kpis.lowStock} item${kpis.lowStock === 1 ? " is" : "s are"} running low on stock.`
            }
          />
        </div>
      ) : null}

      <div className="mt-6">
        <InventorySummarySection />
      </div>

      <div className="mt-6">
        <InventoryAssistantCard />
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
            illustration={hasActiveFilters ? undefined : "inventory"}
            title={hasActiveFilters ? "No items match these filters" : "No inventory items yet"}
            description={hasActiveFilters ? "Try adjusting or clearing your filters." : "Every beautiful detail starts with what's on hand — add your first Item."}
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
