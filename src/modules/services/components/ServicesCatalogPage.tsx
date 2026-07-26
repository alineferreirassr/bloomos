"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useServicesCatalog } from "@/modules/services/hooks/useServicesCatalog";
import {
  ServicesCatalogFilterBar,
  DEFAULT_SERVICES_CATALOG_FILTERS,
  hasActiveServicesCatalogFilters,
  type ServicesCatalogFilterBarValue,
} from "@/modules/services/components/ServicesCatalogFilterBar";
import { ServicesCatalogToolbar } from "@/modules/services/components/ServicesCatalogToolbar";
import { type CatalogViewMode } from "@/modules/services/components/ViewToggle";
import type { ServicesCatalogSortBy } from "@/modules/services/components/SortSelector";
import { BulkSelectionBar } from "@/modules/services/components/BulkSelectionBar";
import { ServiceCardGrid } from "@/modules/services/components/ServiceCardGrid";
import { ServiceListTable } from "@/modules/services/components/ServiceListTable";
import { ServicesLoadingSkeleton, ServicesCatalogEmptyState, ServicesCatalogErrorState } from "@/modules/services/components/ServicesStates";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ActionMenuAction } from "@/components/ui/ActionMenu";
import type { ServiceCatalogRow } from "@/lib/queries/services/types";
import { HEALTH_ATTENTION_THRESHOLD } from "@/lib/queries/services/health";

const VIEW_MODE_STORAGE_KEY = "servicesCatalogViewMode";

function readStoredViewMode(): CatalogViewMode {
  if (typeof window === "undefined") return "grid";
  return window.localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "list" ? "list" : "grid";
}

/**
 * The reference implementation for every future Services screen — consumes
 * only `useServicesCatalog()` (no Repository, no Supabase, no other React
 * Query call outside a feature hook). The `health` filter is the one
 * dimension `useServicesCatalog` itself doesn't support — it's applied here,
 * client-side, over rows the hook already fetched (never recomputing health
 * itself, just bucketing the `percent` each row already carries).
 */
export function ServicesCatalogPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<ServicesCatalogFilterBarValue>(DEFAULT_SERVICES_CATALOG_FILTERS);
  const [sortBy, setSortBy] = useState<ServicesCatalogSortBy>("name");
  const [viewMode, setViewModeState] = useState<CatalogViewMode>("grid");
  const [bulkModeActive, setBulkModeActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reads localStorage exactly once, after mount — a lazy `useState`
  // initializer would run during the SSR pass too (no `window` there),
  // committing "grid" to the server-rendered HTML; reading synchronously
  // during the client's first render instead would diverge from that
  // markup and produce a hydration mismatch. This effect is the deliberate
  // "sync initial state from an external, request-independent source"
  // exception the lint rule's own guidance calls out — not a case of
  // deriving state that render could have computed directly.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewModeState(readStoredViewMode());
  }, []);

  const setViewMode = useCallback((mode: CatalogViewMode) => {
    setViewModeState(mode);
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }, []);

  const query = useServicesCatalog({
    search: filters.search.trim() || undefined,
    status: filters.status,
    categoryId: filters.categoryId,
    includeArchived: filters.includeArchived,
    usage: filters.usage,
    sortBy,
  });

  const rows = useMemo(() => {
    const allRows = query.data?.rows ?? [];
    if (filters.health === "all") return allRows;
    return allRows.filter((row) =>
      filters.health === "healthy" ? row.health.percent >= HEALTH_ATTENTION_THRESHOLD : row.health.percent < HEALTH_ATTENTION_THRESHOLD,
    );
  }, [query.data, filters.health]);

  const categories = query.data?.categories ?? [];

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((current) => (current.size === rows.length ? new Set() : new Set(rows.map((row) => row.service.id))));
  }, [rows]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const exitBulkMode = useCallback(() => {
    setBulkModeActive(false);
    setSelectedIds(new Set());
  }, []);

  const toggleBulkMode = useCallback(() => {
    if (bulkModeActive) exitBulkMode();
    else setBulkModeActive(true);
  }, [bulkModeActive, exitBulkMode]);

  // Stable across renders (only changes if `router` itself changes) — ServiceCard/ServiceListRow are memoized and rely on this identity staying put.
  const actionsFor = useCallback(
    (row: ServiceCatalogRow): ActionMenuAction[] => [{ label: "View", onSelect: () => router.push(`/services/${row.service.id}`) }],
    [router],
  );

  const activeFilters = hasActiveServicesCatalogFilters(filters);
  const allSelected = selectedIds.size > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-text">Services</h1>
        <p className="mt-1 text-sm text-text-muted">Your reusable catalog of bookable Services.</p>
      </header>

      <ServicesCatalogFilterBar value={filters} onChange={setFilters} categories={categories} />

      {query.status === "pending" ? (
        <ServicesLoadingSkeleton rows={4} rowHeightClassName="h-24" />
      ) : query.status === "error" ? (
        <ServicesCatalogErrorState onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        activeFilters ? (
          <EmptyState title="No Services match your filters" description="Try adjusting your search or filters." />
        ) : (
          <ServicesCatalogEmptyState />
        )
      ) : (
        <>
          <ServicesCatalogToolbar
            resultCount={rows.length}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            bulkModeActive={bulkModeActive}
            onToggleBulkMode={toggleBulkMode}
          />

          {bulkModeActive ? (
            <BulkSelectionBar
              selectedCount={selectedIds.size}
              totalCount={rows.length}
              onSelectAll={toggleSelectAll}
              onClear={clearSelection}
              onExit={exitBulkMode}
            />
          ) : null}

          {viewMode === "grid" ? (
            <ServiceCardGrid
              rows={rows}
              selectable={bulkModeActive}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              actionsFor={actionsFor}
            />
          ) : (
            <ServiceListTable
              rows={rows}
              selectable={bulkModeActive}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              allSelected={allSelected}
              someSelected={someSelected}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              actionsFor={actionsFor}
            />
          )}
        </>
      )}
    </div>
  );
}
