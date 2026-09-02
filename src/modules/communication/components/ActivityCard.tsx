"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import {
  ClientsIcon,
  FinanceIcon,
  TaskIcon,
  InventoryIcon,
  AutomationIcon,
  BloomAiIcon,
  DocumentsIcon,
  CommunicationsIcon,
} from "@/components/ui/icons";
import type { ActivityEntry, CommunicationCategory } from "@/types/communication";

const CATEGORY_LABELS: Record<CommunicationCategory, string> = {
  crm: "CRM",
  finance: "Finance",
  operations: "Operations",
  inventory: "Inventory",
  automation: "Automation",
  ai: "Bloom AI",
  documents: "Documents",
  communication: "Communication",
};

/** Closest semantic match per category from the shared icon set (`@/components/ui/icons`) — no new SVGs, matching the icon-per-category precedent `PinnedEventsPanel`/`calendarEventVisuals` already established for this codebase. */
const CATEGORY_ICON: Record<CommunicationCategory, ComponentType<SVGProps<SVGSVGElement>>> = {
  crm: ClientsIcon,
  finance: FinanceIcon,
  operations: TaskIcon,
  inventory: InventoryIcon,
  automation: AutomationIcon,
  ai: BloomAiIcon,
  documents: DocumentsIcon,
  communication: CommunicationsIcon,
};

/** Compact ghost-button treatment for inline row actions — same hover/active states as `Button variant="ghost"`, sized down for a single row (the `!` overrides match the precedent already used for compact ghost buttons elsewhere, e.g. `WidgetCard`/`FavoritesWidget`'s `!px-1.5 text-xs`). */
const ROW_ACTION_CLASS = "!px-2 !py-1 text-xs";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * v2.0 Checkpoint 24, Step 7.5 — the one reusable Activity Card every
 * Timeline/Activity Feed surface renders, per entry. Deliberately
 * richer than the existing generic `modules/timeline/components/Timeline.tsx`
 * (icon-per-category, expand/collapse for long descriptions, a "Jump to
 * entity" deep link) — that component stays as-is for its own callers
 * (e.g. any future direct `TimelineActivity` list); this one is what a
 * merged, multi-source `ActivityEntry[]` needs.
 */
export function ActivityCard({ entry, onQuickReply }: { entry: ActivityEntry; onQuickReply?: (entry: ActivityEntry) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = (entry.description?.length ?? 0) > 160;
  const description = expanded || !isLong ? entry.description : `${entry.description?.slice(0, 160)}…`;
  const Icon = CATEGORY_ICON[entry.category];

  return (
    <LuxuryCard className="flex gap-3 p-4 sm:p-5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent" aria-hidden="true">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="outline">{CATEGORY_LABELS[entry.category]}</Badge>
          {entry.pinned ? <Badge tone="accent">Pinned</Badge> : null}
          <p className="text-sm font-medium text-text">{entry.title}</p>
        </div>
        {description ? (
          <p className="text-sm text-text-muted">
            {description}
            {isLong ? (
              <button type="button" className="ml-1 text-xs text-accent hover:underline" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Show less" : "Show more"}
              </button>
            ) : null}
          </p>
        ) : null}
        <p className="text-xs text-text-muted">
          {entry.actorLabel} · <time dateTime={entry.occurredAt}>{formatTimestamp(entry.occurredAt)}</time>
        </p>
        {entry.deepLink || onQuickReply ? (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {entry.deepLink ? (
              <a
                href={entry.deepLink}
                className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors duration-150 hover:bg-accent/10 active:bg-accent/18"
              >
                Jump to entity
              </a>
            ) : null}
            {onQuickReply ? (
              <Button type="button" variant="ghost" className={ROW_ACTION_CLASS} onClick={() => onQuickReply(entry)}>
                Quick reply
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </LuxuryCard>
  );
}
