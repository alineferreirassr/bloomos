import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { WorkspaceHealthSummary } from "@/types/smartWorkspace";

const BAND_TONE: Record<string, BadgeTone> = { excellent: "success", good: "success", attention: "warning", critical: "danger" };
const BUSINESS_FACING_KEYS = new Set(["assets", "proposals", "contracts", "invoices", "journeys", "capability"]);

/** v2.0 Checkpoint 38, Step 12 — the client/deal-facing slice of Workspace Health: proposals, contracts, invoices, client journeys, capability, and digital assets. The operations-facing slice lives in `OperationalOverviewWidget`. Both read the same `WorkspaceHealthSummary`; neither recomputes anything. */
export function BusinessOverviewWidget({ health }: { health: WorkspaceHealthSummary }) {
  const businessPlatforms = health.platforms.filter((p) => BUSINESS_FACING_KEYS.has(p.key));

  return (
    <div className="flex flex-col gap-2">
      {businessPlatforms.map((platform) => (
        <div key={platform.key} className="flex items-center justify-between text-sm">
          <span className="text-text-muted">{platform.label}</span>
          <span className="flex items-center gap-2">
            <span className="tabular-nums font-medium text-text">{platform.score}</span>
            <Badge tone={BAND_TONE[platform.band]}>{platform.band}</Badge>
          </span>
        </div>
      ))}
      <div className="mt-1 flex flex-wrap gap-3 text-xs">
        <Link href="/proposals" className="font-medium text-accent hover:underline">Proposals →</Link>
        <Link href="/contracts" className="font-medium text-accent hover:underline">Contracts →</Link>
        <Link href="/invoices" className="font-medium text-accent hover:underline">Invoices →</Link>
        <Link href="/client-journeys" className="font-medium text-accent hover:underline">Journeys →</Link>
      </div>
    </div>
  );
}
