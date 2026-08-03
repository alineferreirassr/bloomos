import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ExecutiveBrief } from "@/modules/ai/copilot/briefs/types";

const LINE_TONE: Record<string, BadgeTone> = { info: "accent", success: "success", warning: "warning" };

/** v2.0 Checkpoint 38, Step 12 — the Executive Dashboard as a Workspace widget: reuses the real, deterministic `generateExecutiveBrief()` (Checkpoint 20) rather than a new summarizer, and links out to the full Executive Decisions dashboard. */
export function ExecutiveOverviewWidget({ brief }: { brief: ExecutiveBrief | null }) {
  if (!brief) {
    return <EmptyState title="Executive Brief unavailable" description="Could not be generated right now." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text">{brief.summary}</p>
      <ul className="flex flex-col gap-1.5">
        {brief.lines.slice(0, 5).map((line) => (
          <li key={line.id} className="flex items-start gap-2 text-sm">
            <Badge tone={LINE_TONE[line.tone] ?? "neutral"}>{line.tone}</Badge>
            <span className="text-text-muted">{line.text}</span>
          </li>
        ))}
      </ul>
      <Link href="/assets/executive-decisions" className="text-xs font-medium text-accent hover:underline">
        Open Executive Decisions →
      </Link>
    </div>
  );
}
