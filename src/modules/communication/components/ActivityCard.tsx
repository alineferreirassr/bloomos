"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
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

const CATEGORY_ICON: Record<CommunicationCategory, string> = {
  crm: "👤",
  finance: "💵",
  operations: "📋",
  inventory: "📦",
  automation: "⚙️",
  ai: "✨",
  documents: "📄",
  communication: "💬",
};

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

  return (
    <li className="flex gap-3 rounded-md border border-border/60 p-3">
      <span className="mt-0.5 shrink-0 text-lg" aria-hidden="true">
        {CATEGORY_ICON[entry.category]}
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
          <div className="flex gap-3 pt-0.5">
            {entry.deepLink ? (
              <a href={entry.deepLink} className="text-xs text-accent hover:underline">
                Jump to entity
              </a>
            ) : null}
            {onQuickReply ? (
              <button type="button" className="text-xs text-accent hover:underline" onClick={() => onQuickReply(entry)}>
                Quick reply
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
