import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { WorkspaceRecommendation } from "@/types/smartWorkspace";

const PRIORITY_TONE: Record<string, BadgeTone> = { critical: "danger", high: "warning", medium: "accent", low: "neutral", informational: "outline" };

/** v2.0 Checkpoint 38 — the top of the real Executive Decisions queue (`evaluateExecutiveDecisionsAction`), never a second recommendation pipeline. */
export function RecommendationsWidget({ recommendations }: { recommendations: WorkspaceRecommendation[] }) {
  if (recommendations.length === 0) {
    return <EmptyState title="No open decisions" description="The Executive Decision queue is clear right now." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2.5">
        {recommendations.map((decision) => (
          <li key={decision.id} className="flex flex-col gap-1 border-b border-border/60 pb-2.5 last:border-none last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-text">{decision.title}</p>
              <Badge tone={PRIORITY_TONE[decision.priority] ?? "neutral"}>{decision.priority}</Badge>
            </div>
            <p className="text-xs text-text-muted">{decision.description}</p>
          </li>
        ))}
      </ul>
      <Link href="/assets/executive-decisions" className="text-xs font-medium text-accent hover:underline">
        Open Executive Decisions →
      </Link>
    </div>
  );
}
