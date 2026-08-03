import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { WorkspaceHealthSummary } from "@/types/smartWorkspace";

const BAND_TONE: Record<string, BadgeTone> = { excellent: "success", good: "success", attention: "warning", critical: "danger" };

/** v2.0 Checkpoint 38 — every score here is a direct reuse or plain average of another platform's own Health Engine output; see `core/workspace/workspaceHealthEngine.ts`'s own doc comment for the full disclosure. */
export function WorkspaceHealthWidget({ health }: { health: WorkspaceHealthSummary }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-3xl font-semibold text-text">{health.overallScore}</span>
        <Badge tone={BAND_TONE[health.band]}>{health.band}</Badge>
      </div>
      <ul className="flex flex-col gap-1.5">
        {health.platforms.map((platform) => (
          <li key={platform.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-text-muted">
              {platform.label}
              {platform.isProxy ? <span className="ml-1 text-[10px] uppercase tracking-wide text-text-muted/70">(est.)</span> : null}
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums font-medium text-text">{platform.score}</span>
              <Badge tone={BAND_TONE[platform.band]}>{platform.band}</Badge>
            </span>
          </li>
        ))}
      </ul>
      <Link href="/assets/business-health" className="text-xs font-medium text-accent hover:underline">
        Open Business Health Dashboard →
      </Link>
    </div>
  );
}
