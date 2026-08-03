"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listPurchases, getOpenPurchases, getOverduePurchases, getVendors } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { ModuleInsightCard } from "@/components/ui/ModuleInsightCard";
import { PurchasesIcon, EventsIcon, FinanceIcon } from "@/components/ui/icons";
import { formatMoney, sumMinor } from "@/lib/money";
import { PurchaseFilters, DEFAULT_PURCHASE_FILTERS, type PurchaseFiltersValue } from "@/modules/purchases/components/PurchaseFilters";
import { PurchaseListTable, type PurchaseListRow } from "@/modules/purchases/components/PurchaseListTable";
import { PurchaseListCards } from "@/modules/purchases/components/PurchaseListCards";
import { PurchaseSummarySection } from "@/modules/purchases/components/PurchaseSummarySection";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; rows: PurchaseListRow[] };

/**
 * PurchaseSummarySection already surfaces Open/Overdue/Partially-received/Open
 * value, so this only returns something when it's a genuinely distinct
 * observation: open purchases (submitted or partially received) that have no
 * expected_delivery_date set at all, meaning they can never be flagged as
 * overdue by that summary in the first place.
 */
function buildPurchasesInsight(rows: PurchaseListRow[]): string | null {
  const missingDeliveryDate = rows.filter(
    ({ purchase }) =>
      (purchase.status === "submitted" || purchase.status === "partially_received") &&
      purchase.expected_delivery_date === null,
  ).length;
  if (missingDeliveryDate > 0) {
    return `${missingDeliveryDate} open purchase order${missingDeliveryDate === 1 ? " has" : "s have"} no expected delivery date set.`;
  }
  return null;
}

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

  const kpis =
    state.status === "ready"
      ? {
          total: state.rows.length,
          pending: state.rows.filter(
            ({ purchase }) => purchase.status === "submitted" || purchase.status === "partially_received",
          ).length,
          // Sums total_minor across every currently-listed Purchase and displays it as USD — the
          // same disclosed multi-currency simplification PurchaseSummarySection's own
          // totalOpenValueMinor already uses, since no workspace-level default currency exists yet.
          totalSpendMinor: sumMinor(state.rows.map(({ purchase }) => purchase.total_minor)),
        }
      : null;
  const insight = state.status === "ready" ? buildPurchasesInsight(state.rows) : null;

  return (
    <div>
      <PageHeader
        title="Purchases"
        subtitle={`Purchase orders placed with Vendors. ${getDataPersistenceMessage()}`}
        actions={
          <Link href="/purchases/new">
            <Button type="button">New Purchase</Button>
          </Link>
        }
      />

      {insight ? (
        <div className="animate-fade-up mb-6">
          <ModuleInsightCard insight={insight} tone="warning" />
        </div>
      ) : null}

      {kpis ? (
        <div className="animate-fade-up stagger-1 mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard icon={PurchasesIcon} label="Total Purchase Orders" value={kpis.total.toLocaleString()} />
          <KpiCard icon={EventsIcon} label="Pending" value={kpis.pending.toLocaleString()} />
          <KpiCard icon={FinanceIcon} label="Total Spend" value={formatMoney(kpis.totalSpendMinor, "USD")} />
        </div>
      ) : null}

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
            icon={PurchasesIcon}
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
          <div className="animate-fade-up stagger-2">
            <PurchaseListTable rows={state.rows} onChanged={refetch} />
            <PurchaseListCards rows={state.rows} onChanged={refetch} />
          </div>
        )}
      </div>
    </div>
  );
}
