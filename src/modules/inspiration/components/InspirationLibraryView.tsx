"use client";

import { useEffect, useState } from "react";
import { listInspirationItemsAction, type ListInspirationItemsActionFilters } from "@/modules/inspiration/inspirationActions";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { InspirationIcon, SearchIcon } from "@/components/ui/icons";
import { InspirationCard } from "@/modules/inspiration/components/InspirationCard";
import { AddInspirationDialog } from "@/modules/inspiration/components/AddInspirationDialog";
import { InspirationDetailDialog } from "@/modules/inspiration/components/InspirationDetailDialog";
import { INSPIRATION_SOURCE_TYPE_LABELS, INSPIRATION_CONTENT_FORMAT_LABELS } from "@/modules/inspiration/labels";
import { INSPIRATION_SOURCE_TYPES, INSPIRATION_CONTENT_FORMATS } from "@/types/inspirationItem";
import type { InspirationItem, InspirationSourceType, InspirationContentFormat } from "@/types/inspirationItem";
import type { InspirationArchivedFilter } from "@/lib/data/inspiration/repository";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; items: InspirationItem[] };

interface FilterState {
  search: string;
  sourceType: InspirationSourceType | "all";
  contentFormat: InspirationContentFormat | "all";
  archived: InspirationArchivedFilter;
}

const DEFAULT_FILTERS: FilterState = { search: "", sourceType: "all", contentFormat: "all", archived: "active" };

function toActionFilters(filters: FilterState): ListInspirationItemsActionFilters {
  return {
    archived: filters.archived,
    sourceType: filters.sourceType === "all" ? undefined : filters.sourceType,
    contentFormat: filters.contentFormat === "all" ? undefined : filters.contentFormat,
    search: filters.search.trim() || undefined,
  };
}

function isDefaultFilters(filters: FilterState): boolean {
  return filters.search.trim() === "" && filters.sourceType === "all" && filters.contentFormat === "all" && filters.archived === "active";
}

/**
 * SOCIAL-06D — the Inspiration Library's own read model. Search/filter are
 * backend-authoritative (Phase 9) — this never filters an already-loaded
 * list client-side the way `AssetLibraryView` does; instead the whole
 * `filters` object is debounced as one unit (mirrors
 * `DocumentsListView.tsx`'s exact `useDebouncedValue(filters, 300)`
 * pattern) and every change re-calls `listInspirationItemsAction`. Loading
 * only resets to "loading" on the very first mount — a filter change keeps
 * the previous results visible until the new fetch resolves, then swaps
 * straight to "ready"/"error" (mirrors `SocialAnalyticsView.tsx`'s own
 * documented range-selector pattern, avoiding a synchronous setState inside
 * the effect body).
 */
export function InspirationLibraryView() {
  const { can } = useMemberSession();
  const canCreate = can("social.create");

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [addOpen, setAddOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InspirationItem | null>(null);

  function load(next: FilterState) {
    listInspirationItemsAction(toActionFilters(next)).then((result) => {
      setState(result.success ? { status: "ready", items: result.data } : { status: "error" });
    });
  }

  useEffect(() => {
    load(debouncedFilters);
  }, [debouncedFilters]);

  function reload() {
    load(debouncedFilters);
  }

  function handleCreated() {
    reload();
  }

  function handleChanged(item: InspirationItem) {
    setSelectedItem(item);
    reload();
  }

  const addAction = canCreate ? (
    <Button variant="primary" onClick={() => setAddOpen(true)}>
      Add Inspiration
    </Button>
  ) : null;

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Inspiration" subtitle="Content references and patterns saved for future Amoré Bloom content." icon={InspirationIcon} actions={addAction} />
        <CardGridSkeleton count={8} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div>
        <PageHeader title="Inspiration" icon={InspirationIcon} actions={addAction} />
        <ErrorState message="We couldn't load your Inspiration library." onRetry={reload} />
      </div>
    );
  }

  const items = state.items;
  const filtersAreDefault = isDefaultFilters(filters);

  return (
    <div>
      <PageHeader
        title="Inspiration"
        subtitle="Content references and patterns saved for future Amoré Bloom content."
        icon={InspirationIcon}
        actions={addAction}
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[180px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Search by title…"
            aria-label="Search Inspiration"
            className="pl-8"
          />
        </div>
        <Select
          aria-label="Filter by source"
          value={filters.sourceType}
          onChange={(e) => setFilters((prev) => ({ ...prev, sourceType: e.target.value as InspirationSourceType | "all" }))}
          className="w-auto"
        >
          <option value="all">All sources</option>
          {INSPIRATION_SOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {INSPIRATION_SOURCE_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by content format"
          value={filters.contentFormat}
          onChange={(e) => setFilters((prev) => ({ ...prev, contentFormat: e.target.value as InspirationContentFormat | "all" }))}
          className="w-auto"
        >
          <option value="all">All formats</option>
          {INSPIRATION_CONTENT_FORMATS.map((format) => (
            <option key={format} value={format}>
              {INSPIRATION_CONTENT_FORMAT_LABELS[format]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by archive state"
          value={filters.archived}
          onChange={(e) => setFilters((prev) => ({ ...prev, archived: e.target.value as InspirationArchivedFilter }))}
          className="w-auto"
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </Select>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          illustration="generic"
          title={filtersAreDefault ? "No Inspiration saved yet" : "No results"}
          description={
            filtersAreDefault
              ? "Inspiration is where useful content references and patterns are saved for future Amoré Bloom content."
              : "Try a different search term or filter."
          }
          action={canCreate && filtersAreDefault ? <Button variant="primary" onClick={() => setAddOpen(true)}>Add Inspiration</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <InspirationCard key={item.id} item={item} onOpen={setSelectedItem} />
          ))}
        </div>
      )}

      <AddInspirationDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={handleCreated} />
      <InspirationDetailDialog item={selectedItem} onClose={() => setSelectedItem(null)} canManage={canCreate} onChanged={handleChanged} />
    </div>
  );
}
