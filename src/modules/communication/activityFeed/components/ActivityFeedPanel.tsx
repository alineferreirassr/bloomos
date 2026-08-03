"use client";

import { useEffect, useState } from "react";
import { getActivityFeedData } from "@/modules/communication/activityFeed/getActivityFeedData";
import { ActivityCard } from "@/modules/communication/components/ActivityCard";
import { ExportMenu } from "@/modules/analytics/export/components/ExportMenu";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { COMMUNICATION_CATEGORIES } from "@/types/communication";
import type { ActivityEntry, CommunicationCategory } from "@/types/communication";

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

const MAX_VISIBLE = 100;

/** v2.0 Checkpoint 24, Step 7 — the workspace-wide Activity Feed. Same engine as `EntityTimelinePanel`, no owner scope — see `aggregateActivity`'s own doc comment. */
export function ActivityFeedPanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [category, setCategory] = useState<CommunicationCategory | "all">("all");

  const fetchData = () => {
    getActivityFeedData().then((result) => {
      if (result.success) setState({ status: "ready", entries: result.data });
      else setState({ status: "error", message: result.error });
    });
  };

  useEffect(fetchData, []);

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  const filtered = (category === "all" ? state.entries : state.entries.filter((e) => e.category === category)).slice(0, MAX_VISIBLE);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ExportMenu
          filenameBase="activity-feed"
          sheetName="Activity Feed"
          headers={["Category", "Title", "Description", "Actor", "Occurred At"]}
          rows={state.entries.map((e) => [e.category, e.title, e.description ?? "", e.actorLabel, e.occurredAt])}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${category === "all" ? "bg-accent text-accent-foreground" : "bg-surface-hover text-text-muted"}`}
        >
          All
        </button>
        {COMMUNICATION_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${category === c ? "bg-accent text-accent-foreground" : "bg-surface-hover text-text-muted"}`}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No activity yet" description="Workspace-wide activity across every module will appear here." />
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
