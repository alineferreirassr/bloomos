"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listPurchases, getOpenPurchases, getOverduePurchases, getVendors } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PurchaseFilters, DEFAULT_PURCHASE_FILTERS, type PurchaseFiltersValue } from "@/modules/purchases/components/PurchaseFilters";
import { PurchaseListTable, type PurchaseListRow } from "@/modules/purchases/components/PurchaseListTable";
import { PurchaseListCards } from "@/modules/purchases/components/PurchaseListCards";
import { PurchaseSummarySection } from "@/modules/purchases/components/PurchaseSummarySection";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; rows: PurchaseListRow[] };

/**
 * openOnly/overdueOnly are separate repository methods (getOpenPurchases/
 * getOverduePurchases), not fields on PurchaseFilters — when either is
 * active it takes over the fetch entirely rather than being combined with
 * search/status, since those two dedicated methods accept no filter
 * parameters of their own. Vendor is joined client-side the same way
 * InvoicesListView joins Client — Purchase only stores vendor_id.
 */
async function loadPurchasesFor(filters: PurchaseFiltersValue): Promise<LoadState> {
  try {
    const [purchases, vendors] = await Promise.all([
      filters.overdueOnly
        ? getOverduePurchases()
        : filters.openOnly
          ? getOpenPurchases()
          : listPurchases({ search: filters.search, status: filters.status, includeArchived: filters.includeArchived }),
      getVendors({ includeArchived: true }),
    ]);
    const vendorsById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
    const rows: PurchaseListRow[] = purchases.map((purchase) => ({ purchase, vendor: vendorsById.get(purchase.vendor_id) }));
    return { status: "ready", rows };
  } catch {
    return { status: "error" };
  }
}

export function PurchasesListView() {
  const [filters, setFilters] = useState<PurchaseFiltersValue>(DEFAULT_PURCHASE_FILTERS);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadPurchasesFor(DEFAULT_PURCHASE_FILTERS).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiltersChange = (next: PurchaseFiltersValue) => {
    setFilters(next);
    setState({ status: "loading" });
    loadPurchasesFor(next).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadPurchasesFor(filters).then(setState);
  };

  const refetch = () => {
    loadPurchasesFor(filters).then(setState);
  };

  const hasActiveFilters =
    filters.search !== "" || filters.status !== "all" || filters.openOnly || filters.overdueOnly;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-text">Purchases</h2>
          <p className="mt-1 text-sm text-text-muted">Purchase orders placed with Vendors. {getDataPersistenceMessage()}</p>
        </div>
        <Link href="/purchases/new">
          <Button type="button">New Purchase</Button>
        </Link>
      </div>

      <div className="mt-6">
        <PurchaseSummarySection />
      </div>

      <div className="mt-6">
        <PurchaseFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3" aria-live="polite" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message="Could not load purchases." onRetry={retry} />
        ) : state.rows.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No purchases match these filters" : "No purchases yet"}
            description={hasActiveFilters ? "Try adjusting or clearing your filters." : "Purchases you create will show up here."}
            action={
              !hasActiveFilters ? (
                <Link href="/purchases/new">
                  <Button type="button">New Purchase</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <PurchaseListTable rows={state.rows} onChanged={refetch} />
            <PurchaseListCards rows={state.rows} onChanged={refetch} />
          </>
        )}
      </div>
    </div>
  );
}
