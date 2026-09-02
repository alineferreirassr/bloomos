"use client";

import { useEffect, useState } from "react";
import { getActivityFeedData } from "@/modules/communication/activityFeed/getActivityFeedData";
import { ActivityCard } from "@/modules/communication/components/ActivityCard";
import { ExportMenu } from "@/modules/analytics/export/components/ExportMenu";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, TabList, Tab } from "@/components/ui/Tabs";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={category} onValueChange={(value) => setCategory(value as CommunicationCategory | "all")} className="min-w-0 flex-1">
          <TabList aria-label="Filter activity by category">
            <Tab value="all">All</Tab>
            {COMMUNICATION_CATEGORIES.map((c) => (
              <Tab key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </Tab>
            ))}
          </TabList>
        </Tabs>
        <div className="flex justify-end sm:shrink-0">
          <ExportMenu
            filenameBase="activity-feed"
            sheetName="Activity Feed"
            headers={["Category", "Title", "Description", "Actor", "Occurred At"]}
            rows={state.entries.map((e) => [e.category, e.title, e.description ?? "", e.actorLabel, e.occurredAt])}
          />
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState illustration="generic" title="No activity yet" description="Workspace-wide activity across every module will appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <ActivityCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
