"use client";

import { useEffect, useState } from "react";
import { getEntityTimelineData } from "@/modules/communication/timeline/getEntityTimelineData";
import { ActivityCard } from "@/modules/communication/components/ActivityCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { COMMUNICATION_CATEGORIES } from "@/types/communication";
import type { ActivityEntry, CommunicationCategory } from "@/types/communication";
import type { EntityType } from "@/core/enums/entityType";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; entries: ActivityEntry[] };

const CATEGORY_LABEL: Record<CommunicationCategory, string> = {
  crm: "CRM",
  finance: "Finance",
  operations: "Operations",
  inventory: "Inventory",
  automation: "Automation",
  ai: "Bloom AI",
  documents: "Documents",
  communication: "Communication",
};

/**
 * v2.0 Checkpoint 24, Step 7.5 — the Unified Communication Timeline for one
 * entity. Mounted as a section/tab on an entity's own detail page (Client,
 * Event, Vendor, Invoice — see `docs/communication-timeline.md` for the
 * exact wiring list). Filtering and search happen client-side over one
 * already-fetched window (matching the "cheap, no extra fan-out" precedent
 * every other Analytics/Reports table in this codebase already uses).
 */
export function EntityTimelinePanel({ ownerType, ownerId }: { ownerType: EntityType; ownerId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [category, setCategory] = useState<CommunicationCategory | "all">("all");
  const [search, setSearch] = useState("");

  const fetchData = () => {
    getEntityTimelineData(ownerType, ownerId).then((result) => {
      if (result.success) setState({ status: "ready", entries: result.data });
      else setState({ status: "error", message: result.error });
    });
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerType, ownerId]);

  if (state.status === "loading") return <Skeleton className="h-48 w-full" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  const filtered = state.entries.filter((entry) => {
    if (category !== "all" && entry.category !== category) return false;
    if (search.trim() && !`${entry.title} ${entry.description ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search this timeline…"
          aria-label="Search timeline"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-none"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CommunicationCategory | "all")}
          aria-label="Filter by category"
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text"
        >
          <option value="all">All categories</option>
          {COMMUNICATION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="Nothing here yet" description="Comments, notifications, and other activity for this record will appear here." />
      ) : (
        <ul className="space-y-2">
          {filtered.map((entry) => (
            <ActivityCard key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}
