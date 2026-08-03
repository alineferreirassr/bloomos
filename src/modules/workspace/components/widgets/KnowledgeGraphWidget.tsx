import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import type { GraphStats } from "@/modules/knowledgeGraph/knowledgeGraphActions";

/** v2.0 Checkpoint 38, Step 9 — visualizes the real Knowledge Graph via its own `getGraphStatsAction()`, then links out to the full Relationship Explorer UI (Checkpoint 25 continuation) rather than rebuilding it inline. */
export function KnowledgeGraphWidget({ graphStats }: { graphStats: GraphStats | null }) {
  if (!graphStats) {
    return <EmptyState title="Knowledge Graph unavailable" description="Stats could not be loaded right now." />;
  }

  const topRelationshipTypes = Object.entries(graphStats.byRelationshipType)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xl font-semibold text-text">{graphStats.totalActive}</p>
          <p className="text-xs text-text-muted">Active edges</p>
        </div>
        <div>
          <p className="text-xl font-semibold text-text">{Object.keys(graphStats.byNodeType).length}</p>
          <p className="text-xs text-text-muted">Node types</p>
        </div>
        <div>
          <p className="text-xl font-semibold text-text">{graphStats.duplicateGroupCount}</p>
          <p className="text-xs text-text-muted">Duplicate groups</p>
        </div>
      </div>
      {topRelationshipTypes.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {topRelationshipTypes.map(([type, count]) => (
            <li key={type} className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
              {type} · {count}
            </li>
          ))}
        </ul>
      ) : null}
      <Link href="/assets/knowledge-graph" className="text-xs font-medium text-accent hover:underline">
        Open Knowledge Graph Explorer →
      </Link>
    </div>
  );
}
