"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getVendors } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { Vendor } from "@/types/vendor";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { ModuleInsightCard } from "@/components/ui/ModuleInsightCard";
import { VendorsIcon, CheckIcon, BloomAiIcon } from "@/components/ui/icons";
import { VendorFilters, DEFAULT_VENDOR_FILTERS, type VendorFiltersValue } from "@/modules/vendors/components/VendorFilters";
import { VendorListTable } from "@/modules/vendors/components/VendorListTable";
import { VendorListCards } from "@/modules/vendors/components/VendorListCards";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; vendors: Vendor[] };

/**
 * Checkpoint 19.2 — a real, data-derived observation computed from the
 * already-fetched Vendor list, never an AI/LLM call. Prioritizes the more
 * actionable signal (active vendors with no way to reach them) over the
 * softer "preferred" count.
 */
function buildVendorsInsight(vendors: Vendor[]): { insight: string; tone: "info" | "warning" } | null {
  const missingContact = vendors.filter(
    (vendor) => vendor.archived_at === null && !vendor.email && !vendor.phone,
  ).length;
  if (missingContact > 0) {
    return {
      insight: `${missingContact} vendor${missingContact === 1 ? "" : "s"} ${missingContact === 1 ? "has" : "have"} no email or phone on file.`,
      tone: "warning",
    };
  }
  const preferred = vendors.filter((vendor) => vendor.archived_at === null && vendor.is_preferred).length;
  if (preferred > 0) {
    return { insight: `${preferred} preferred vendor${preferred === 1 ? "" : "s"} on file.`, tone: "info" };
  }
  return null;
}

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
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [retryToken, setRetryToken] = useState(0);

  // Fetch once on mount, then refetch whenever the debounced filters change
  // (so a search keystroke doesn't trigger a request until typing pauses)
  // or the user hits retry. Row-level create/archive/restore refetch
  // directly via `refetch` below, bypassing the debounce.
  useEffect(() => {
    let cancelled = false;
    loadVendorsFor(debouncedFilters).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, retryToken]);

  const handleFiltersChange = (next: VendorFiltersValue) => {
    setFilters(next);
    setState({ status: "loading" });
  };

  const retry = () => {
    setState({ status: "loading" });
    setRetryToken((token) => token + 1);
  };

  const refetch = () => {
    loadVendorsFor(filters).then(setState);
  };

  const hasActiveFilters =
    filters.search !== "" || filters.status !== "all" || filters.preferredOnly || filters.tag !== "";

  const kpis =
    state.status === "ready"
      ? {
          total: state.vendors.length,
          active: state.vendors.filter((vendor) => vendor.status === "active").length,
          preferred: state.vendors.filter((vendor) => vendor.is_preferred).length,
        }
      : null;
  const insight = state.status === "ready" ? buildVendorsInsight(state.vendors) : null;

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle={`Suppliers Amoré Bloom purchases from or books through. ${getDataPersistenceMessage()}`}
        actions={
          <Link href="/vendors/new">
            <Button type="button">New Vendor</Button>
          </Link>
        }
      />

      {insight ? (
        <div className="animate-fade-up mb-6">
          <ModuleInsightCard insight={insight.insight} tone={insight.tone} />
        </div>
      ) : null}

      {kpis ? (
        <div className="animate-fade-up stagger-1 mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard icon={VendorsIcon} label="Total Vendors" value={kpis.total.toLocaleString()} />
          <KpiCard icon={CheckIcon} label="Active" value={kpis.active.toLocaleString()} />
          <KpiCard icon={BloomAiIcon} label="Preferred" value={kpis.preferred.toLocaleString()} />
        </div>
      ) : null}

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
            icon={hasActiveFilters ? VendorsIcon : undefined}
            illustration={hasActiveFilters ? undefined : "vendors"}
            title={hasActiveFilters ? "No vendors match these filters" : "No vendors yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "Your trusted partners will appear here — add your first Vendor."
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
          <div className="animate-fade-up stagger-2">
            <VendorListTable vendors={state.vendors} onChanged={refetch} />
            <VendorListCards vendors={state.vendors} onChanged={refetch} />
          </div>
        )}
      </div>
    </div>
  );
}
