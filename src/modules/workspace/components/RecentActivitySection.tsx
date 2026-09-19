import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { EditorialSectionHeader } from "@/components/ui/EditorialSectionHeader";
import type { ActivityEntry } from "@/types/smartWorkspace";

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * VISUAL-01 Revision B, Part D — Workspace's own editorial "Recent
 * activity" section, immediately below "The studio today." Reads the same
 * real, already-fetched `summary.recentActivity` (from
 * `getActivityFeedData()`) the existing `ActivityFeedWidget` uses inside
 * the customizable widget grid below — this is a restyled, always-visible
 * presentation of the same real data, not a second activity system.
 *
 * The founder's AF reference links this section's heading to a
 * "Timeline →" destination. BloomOS has no dedicated `/timeline` route
 * (confirmed: only an unrelated client-portal `/client-access/timeline`
 * exists) — inventing one would be a broken link. `/inbox` is the real,
 * existing destination for the full unified activity feed (the same one
 * `ActivityFeedWidget` already links to as "Open full Activity Feed →"),
 * so this reuses that truthful route with an honest label instead.
 *
 * GLOBAL-VISUAL-03B.1 — heading rebuilt onto the same `EditorialSectionHeader`
 * Relationships and "The studio today" now use, instead of a bare `h2`, so
 * the transition from the KPI section into this one reads as one consistent
 * editorial system rather than two different heading treatments stacked.
 */
export function RecentActivitySection({ entries }: { entries: ActivityEntry[] }) {
  return (
    <div>
      <EditorialSectionHeader
        eyebrow="Activity"
        title="Recent activity"
        action={
          <Link href="/inbox" className="text-luxury-small font-medium text-luxury-rose">
            View all →
          </Link>
        }
      />
      <div className="mt-4 rounded-luxury-lg border border-luxury-border bg-luxury-surface shadow-luxury-sm">
        {entries.length === 0 ? (
          <div className="p-7">
            <EmptyState title="No activity yet" description="Activity across every module will appear here." />
          </div>
        ) : (
          <ul>
            {entries.slice(0, 7).map((entry, index) => (
              <li key={entry.id} className={`flex items-center justify-between gap-4 px-7 py-4 ${index > 0 ? "border-t border-luxury-border" : ""}`}>
                <div className="min-w-0">
                  <p className="truncate text-luxury-body text-luxury-text">{entry.title}</p>
                  <p className="mt-0.5 text-luxury-small text-luxury-text-muted">{entry.actorLabel}</p>
                </div>
                <span className="shrink-0 text-luxury-small text-luxury-text-muted">{formatRelativeTime(entry.occurredAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
