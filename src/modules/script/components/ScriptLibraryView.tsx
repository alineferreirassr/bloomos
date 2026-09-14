"use client";

import { useEffect, useRef, useState } from "react";
import { listScriptItemsAction, type ListScriptItemsActionFilters } from "@/modules/script/scriptActions";
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
import { ScriptIcon, SearchIcon } from "@/components/ui/icons";
import { ScriptCard } from "@/modules/script/components/ScriptCard";
import { AddScriptDialog } from "@/modules/script/components/AddScriptDialog";
import { ScriptDetailDialog } from "@/modules/script/components/ScriptDetailDialog";
import type { ScriptItem } from "@/types/scriptItem";
import type { ScriptArchivedFilter } from "@/lib/data/script/repository";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; items: ScriptItem[] };

interface FilterState {
  search: string;
  archived: ScriptArchivedFilter;
}

const DEFAULT_FILTERS: FilterState = { search: "", archived: "active" };

function toActionFilters(filters: FilterState): ListScriptItemsActionFilters {
  return {
    archived: filters.archived,
    search: filters.search.trim() || undefined,
  };
}

function isDefaultFilters(filters: FilterState): boolean {
  return filters.search.trim() === "" && filters.archived === "active";
}

/**
 * SOCIAL-08D — the Script Studio Library's own read model, mirroring
 * `IdeaLibraryView.tsx`'s own shape exactly, including the SOCIAL-07F
 * hardening lesson applied from the start: a monotonic request-id guard so
 * an older, slower response can never overwrite a newer one's result.
 * Search/filter are backend-authoritative. Detail (including title/source-
 * Idea editing, archive/restore, and version/block management) all live in
 * `ScriptDetailDialog` — there is no separate Edit dialog, since Script's
 * own directly-editable field set is small.
 */
export function ScriptLibraryView() {
  const { can } = useMemberSession();
  const canCreate = can("social.create");

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [addOpen, setAddOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScriptItem | null>(null);
  const latestRequestIdRef = useRef(0);

  function load(next: FilterState) {
    const requestId = ++latestRequestIdRef.current;
    listScriptItemsAction(toActionFilters(next)).then((result) => {
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

  function handleChanged(item: ScriptItem) {
    setSelectedItem(item);
    reload();
  }

  const addAction = canCreate ? (
    <Button variant="primary" className="px-5 py-2.5 text-sm" onClick={() => setAddOpen(true)}>
      New Script
    </Button>
  ) : null;

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Scripts" subtitle="Ordered scenes and blocks ready to produce Amoré Bloom content." icon={ScriptIcon} actions={addAction} />
        <CardGridSkeleton count={8} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div>
        <PageHeader title="Scripts" icon={ScriptIcon} actions={addAction} />
        <ErrorState message="We couldn't load your Scripts library." onRetry={reload} />
      </div>
    );
  }

  const items = state.items;
  const filtersAreDefault = isDefaultFilters(filters);

  return (
    <div>
      <PageHeader title="Scripts" subtitle="Ordered scenes and blocks ready to produce Amoré Bloom content." icon={ScriptIcon} actions={addAction} />

      <Card className="mb-5 flex flex-wrap items-center gap-2 p-2.5">
        <div className="relative min-w-[160px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Search by title…"
            aria-label="Search Scripts"
            className="pl-8"
          />
        </div>
        <Select
          aria-label="Filter by archive state"
          value={filters.archived}
          onChange={(e) => setFilters((prev) => ({ ...prev, archived: e.target.value as ScriptArchivedFilter }))}
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
          title={filtersAreDefault ? "No Scripts yet" : "No results"}
          description={
            filtersAreDefault
              ? "Scripts is where an Idea becomes ordered scenes and blocks ready to produce."
              : "Try a different search term or filter."
          }
          action={canCreate && filtersAreDefault ? <Button variant="primary" onClick={() => setAddOpen(true)}>New Script</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] items-start gap-5">
          {items.map((item) => (
            <ScriptCard key={item.id} item={item} onOpen={setSelectedItem} />
          ))}
        </div>
      )}

      <AddScriptDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={handleCreated} />
      <ScriptDetailDialog item={selectedItem} onClose={() => setSelectedItem(null)} canManage={canCreate} onChanged={handleChanged} />
    </div>
  );
}
