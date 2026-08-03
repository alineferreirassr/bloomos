import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ActivityEntry, WorkspaceActivityDigest } from "@/types/smartWorkspace";

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
 * v2.0 Checkpoint 38, Step 4 — reads the real, workspace-wide Timeline via
 * `getActivityFeedData()` (Checkpoint 24). No parallel activity system:
 * `digest` is a pure summarization of the same `entries` this list
 * renders, computed by `core/workspace/activityFeedEngine.ts`.
 */
export function ActivityFeedWidget({ entries, digest }: { entries: ActivityEntry[]; digest: WorkspaceActivityDigest }) {
  if (entries.length === 0) {
    return <EmptyState title="No activity yet" description="Timeline events across every module will appear here." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-muted">
        {digest.totalEvents} events{digest.mostActiveCategory ? ` · mostly ${digest.mostActiveCategory}` : ""}
      </p>
      <ul className="flex flex-col gap-2">
        {entries.slice(0, 8).map((entry) => (
          <li key={entry.id} className="flex items-start justify-between gap-2 text-sm">
            <div>
              <p className="text-text">{entry.title}</p>
              <p className="text-xs text-text-muted">{entry.actorLabel}</p>
            </div>
            <span className="shrink-0 text-xs text-text-muted">{formatRelativeTime(entry.occurredAt)}</span>
          </li>
        ))}
      </ul>
      <Link href="/inbox" className="text-xs font-medium text-accent hover:underline">
        Open full Activity Feed →
      </Link>
    </div>
  );
}
