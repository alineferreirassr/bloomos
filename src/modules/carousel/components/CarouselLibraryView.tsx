"use client";

import { useEffect, useRef, useState } from "react";
import { listCarouselItemsAction, type ListCarouselItemsActionFilters } from "@/modules/carousel/carouselActions";
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
import { CarouselIcon, SearchIcon } from "@/components/ui/icons";
import { CarouselCard } from "@/modules/carousel/components/CarouselCard";
import { AddCarouselDialog } from "@/modules/carousel/components/AddCarouselDialog";
import { CarouselDetailDialog } from "@/modules/carousel/components/CarouselDetailDialog";
import type { CarouselItem } from "@/types/carouselItem";
import type { CarouselArchivedFilter } from "@/lib/data/carousel/repository";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; items: CarouselItem[] };

interface FilterState {
  search: string;
  archived: CarouselArchivedFilter;
}

const DEFAULT_FILTERS: FilterState = { search: "", archived: "active" };

function toActionFilters(filters: FilterState): ListCarouselItemsActionFilters {
  return {
    archived: filters.archived,
    search: filters.search.trim() || undefined,
  };
}

function isDefaultFilters(filters: FilterState): boolean {
  return filters.search.trim() === "" && filters.archived === "active";
}

/**
 * SOCIAL-10E — the Carousel Studio Library's own read model, mirroring
 * `ScriptLibraryView.tsx`'s own shape exactly, including the SOCIAL-07F
 * hardening lesson applied from the start: a monotonic request-id guard so
 * an older, slower response can never overwrite a newer one's result.
 * Search/filter are backend-authoritative. Detail (including title/source-
 * Idea editing, archive/restore, and slide management) all live in
 * `CarouselDetailDialog` — there is no separate Edit dialog, since
 * Carousel's own directly-editable field set is small.
 */
export function CarouselLibraryView() {
  const { can } = useMemberSession();
  const canCreate = can("social.create");

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [addOpen, setAddOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CarouselItem | null>(null);
  const latestRequestIdRef = useRef(0);

  function load(next: FilterState) {
    const requestId = ++latestRequestIdRef.current;
    listCarouselItemsAction(toActionFilters(next)).then((result) => {
      if (requestId !== latestRequestIdRef.current) return;
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

  function handleChanged(item: CarouselItem) {
    setSelectedItem(item);
    reload();
  }

  const addAction = canCreate ? (
    <Button variant="primary" className="px-5 py-2.5 text-sm" onClick={() => setAddOpen(true)}>
      New Carousel
    </Button>
  ) : null;

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Carousels" subtitle="Ordered slides ready to plan Amoré Bloom carousel content." icon={CarouselIcon} actions={addAction} />
        <CardGridSkeleton count={8} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div>
        <PageHeader title="Carousels" icon={CarouselIcon} actions={addAction} />
        <ErrorState message="We couldn't load your Carousels library." onRetry={reload} />
      </div>
    );
  }

  const items = state.items;
  const filtersAreDefault = isDefaultFilters(filters);

  return (
    <div>
      <PageHeader title="Carousels" subtitle="Ordered slides ready to plan Amoré Bloom carousel content." icon={CarouselIcon} actions={addAction} />

      <Card className="mb-5 flex flex-wrap items-center gap-2 p-2.5">
        <div className="relative min-w-[160px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Search by title…"
            aria-label="Search Carousels"
            className="pl-8"
          />
        </div>
        <Select
          aria-label="Filter by archive state"
          value={filters.archived}
          onChange={(e) => setFilters((prev) => ({ ...prev, archived: e.target.value as CarouselArchivedFilter }))}
          className="w-auto shrink-0"
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </Select>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          illustration="generic"
          title={filtersAreDefault ? "No Carousels yet" : "No results"}
          description={
            filtersAreDefault
              ? "Carousels is where an Idea becomes an ordered set of slides ready to plan."
              : "Try a different search term or filter."
          }
          action={canCreate && filtersAreDefault ? <Button variant="primary" onClick={() => setAddOpen(true)}>New Carousel</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] items-start gap-5">
          {items.map((item) => (
            <CarouselCard key={item.id} item={item} onOpen={setSelectedItem} />
          ))}
        </div>
      )}

      <AddCarouselDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={handleCreated} />
      <CarouselDetailDialog item={selectedItem} onClose={() => setSelectedItem(null)} canManage={canCreate} onChanged={handleChanged} />
    </div>
  );
}
