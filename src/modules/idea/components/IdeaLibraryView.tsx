"use client";

import { useEffect, useRef, useState } from "react";
import { listIdeaItemsAction, type ListIdeaItemsActionFilters } from "@/modules/idea/ideaActions";
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
import { IdeaIcon, SearchIcon } from "@/components/ui/icons";
import { IdeaCard } from "@/modules/idea/components/IdeaCard";
import { AddIdeaDialog } from "@/modules/idea/components/AddIdeaDialog";
import { IdeaDetailDialog } from "@/modules/idea/components/IdeaDetailDialog";
import { EditIdeaDialog } from "@/modules/idea/components/EditIdeaDialog";
import type { IdeaItem } from "@/types/ideaItem";
import type { IdeaArchivedFilter } from "@/lib/data/idea/repository";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; items: IdeaItem[] };

interface FilterState {
  search: string;
  archived: IdeaArchivedFilter;
}

const DEFAULT_FILTERS: FilterState = { search: "", archived: "active" };

function toActionFilters(filters: FilterState): ListIdeaItemsActionFilters {
  return {
    archived: filters.archived,
    search: filters.search.trim() || undefined,
  };
}

function isDefaultFilters(filters: FilterState): boolean {
  return filters.search.trim() === "" && filters.archived === "active";
}

/**
 * SOCIAL-07D/07E — the Ideas Library's own read model, mirroring
 * `InspirationLibraryView.tsx`'s own shape exactly. Search/filter are
 * backend-authoritative — this never filters an already-loaded list
 * client-side; the whole `filters` object is debounced as one unit and
 * every change re-calls `listIdeaItemsAction`. Only a single archive-state
 * filter exists (active/archived/all) — the approved 07B/07C status model
 * has no other filterable dimension in this checkpoint's scope. Library →
 * Detail → Edit → Save → Detail refreshed → Library refreshed (SOCIAL-07E),
 * mirroring `InspirationLibraryView.tsx`'s own SOCIAL-06E flow exactly.
 */
export function IdeaLibraryView() {
  const { can } = useMemberSession();
  const canCreate = can("social.create");

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [addOpen, setAddOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<IdeaItem | null>(null);
  const [editingItem, setEditingItem] = useState<IdeaItem | null>(null);
  /** SOCIAL-07F hardening — guards against an older, slower request overwriting a newer one's result (e.g. a stale debounced search response arriving after a manual `reload()`). Only the result matching the most recently *started* request is ever applied. */
  const latestRequestIdRef = useRef(0);

  function load(next: FilterState) {
    const requestId = ++latestRequestIdRef.current;
    listIdeaItemsAction(toActionFilters(next)).then((result) => {
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

  function handleChanged(item: IdeaItem) {
    setSelectedItem(item);
    reload();
  }

  /** Library → Detail → Edit — closes Detail while Edit is open (only one dialog visible at a time), rather than stacking two Modals. Mirrors `InspirationLibraryView.tsx`'s own `handleEdit` exactly. */
  function handleEdit(item: IdeaItem) {
    setEditingItem(item);
    setSelectedItem(null);
  }

  /** Edit → Save → Detail refreshed → Library refreshed. */
  function handleSaved(item: IdeaItem) {
    setEditingItem(null);
    setSelectedItem(item);
    reload();
  }

  const addAction = canCreate ? (
    <Button variant="primary" className="px-5 py-2.5 text-sm" onClick={() => setAddOpen(true)}>
      New Idea
    </Button>
  ) : null;

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Ideas" subtitle="Original content concepts for future Amoré Bloom content." icon={IdeaIcon} actions={addAction} />
        <CardGridSkeleton count={8} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div>
        <PageHeader title="Ideas" icon={IdeaIcon} actions={addAction} />
        <ErrorState message="We couldn't load your Ideas library." onRetry={reload} />
      </div>
    );
  }

  const items = state.items;
  const filtersAreDefault = isDefaultFilters(filters);

  return (
    <div>
      <PageHeader title="Ideas" subtitle="Original content concepts for future Amoré Bloom content." icon={IdeaIcon} actions={addAction} />

      <Card className="mb-5 flex flex-wrap items-center gap-2 p-2.5">
        <div className="relative min-w-[160px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Search by title…"
            aria-label="Search Ideas"
            className="pl-8"
          />
        </div>
        <Select
          aria-label="Filter by archive state"
          value={filters.archived}
          onChange={(e) => setFilters((prev) => ({ ...prev, archived: e.target.value as IdeaArchivedFilter }))}
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
          title={filtersAreDefault ? "No Ideas yet" : "No results"}
          description={
            filtersAreDefault
              ? "Ideas is where original Amoré Bloom content concepts are captured for future production."
              : "Try a different search term or filter."
          }
          action={canCreate && filtersAreDefault ? <Button variant="primary" onClick={() => setAddOpen(true)}>New Idea</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] items-start gap-5">
          {items.map((item) => (
            <IdeaCard key={item.id} item={item} onOpen={setSelectedItem} />
          ))}
        </div>
      )}

      <AddIdeaDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={handleCreated} />
      <IdeaDetailDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        canManage={canCreate}
        onChanged={handleChanged}
        onEdit={canCreate ? handleEdit : undefined}
      />
      <EditIdeaDialog item={editingItem} onClose={() => setEditingItem(null)} onSaved={handleSaved} />
    </div>
  );
}
