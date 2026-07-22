"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getVendors } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { Vendor } from "@/types/vendor";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { VendorFilters, DEFAULT_VENDOR_FILTERS, type VendorFiltersValue } from "@/modules/vendors/components/VendorFilters";
import { VendorListTable } from "@/modules/vendors/components/VendorListTable";
import { VendorListCards } from "@/modules/vendors/components/VendorListCards";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; vendors: Vendor[] };

async function loadVendorsFor(filters: VendorFiltersValue): Promise<LoadState> {
  try {
    const vendors = await getVendors(
      {
        search: filters.search,
        status: filters.status,
        isPreferred: filters.preferredOnly ? true : undefined,
        tags: filters.tag.trim() ? [filters.tag.trim()] : undefined,
        includeArchived: filters.includeArchived,
      },
      { sortBy: filters.sortBy, sortDirection: filters.sortDirection },
    );
    return { status: "ready", vendors };
  } catch {
    return { status: "error" };
  }
}

export function VendorsListView() {
  const [filters, setFilters] = useState<VendorFiltersValue>(DEFAULT_VENDOR_FILTERS);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // Same rationale as every other List view in the app: fetch once on
  // mount, then only ever refetch in direct response to a user action
  // (filter change, retry, or a row-level create/archive/restore).
  useEffect(() => {
    let cancelled = false;
    loadVendorsFor(DEFAULT_VENDOR_FILTERS).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiltersChange = (next: VendorFiltersValue) => {
    setFilters(next);
    setState({ status: "loading" });
    loadVendorsFor(next).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadVendorsFor(filters).then(setState);
  };

  const refetch = () => {
    loadVendorsFor(filters).then(setState);
  };

  const hasActiveFilters =
    filters.search !== "" || filters.status !== "all" || filters.preferredOnly || filters.tag !== "";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-text">Vendors</h2>
          <p className="mt-1 text-sm text-text-muted">
            Suppliers Amoré Bloom purchases from or books through. {getDataPersistenceMessage()}
          </p>
        </div>
        <Link href="/vendors/new">
          <Button type="button">New Vendor</Button>
        </Link>
      </div>

      <div className="mt-6">
        <VendorFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message="Could not load vendors." onRetry={retry} />
        ) : state.vendors.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No vendors match these filters" : "No vendors yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "Suppliers you add will show up here."
            }
            action={
              !hasActiveFilters ? (
                <Link href="/vendors/new">
                  <Button type="button">New Vendor</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <VendorListTable vendors={state.vendors} onChanged={refetch} />
            <VendorListCards vendors={state.vendors} onChanged={refetch} />
          </>
        )}
      </div>
    </div>
  );
}
