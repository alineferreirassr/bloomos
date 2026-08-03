"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { HealthDot } from "@/modules/services/components/HealthDot";
import type { HealthCategoryStatus } from "@/modules/services/serviceHealthNavigation";
import type { ServiceHealthMissingItem } from "@/lib/queries/services/types";

interface HealthSummarySidebarProps {
  percent: number;
  blockingCount: number;
  warningCount: number;
  statuses: HealthCategoryStatus[];
  onNavigate: (jumpTo: ServiceHealthMissingItem["jumpTo"]) => void;
}

/**
 * "Publish readiness" here is deliberately Health-native, not the real
 * publish gate (`canPublishServiceVersion`, surfaced by Publish Preview) —
 * this tab consumes only `useServiceHealth`, no version-status data, so it
 * can only ever say "nothing in Health is blocking," never "this Service
 * can be published" outright (a published/non-draft version could still
 * block publish for reasons Health never sees). The copy says so plainly
 * rather than silently overstating what's known here.
 */
export function HealthSummarySidebar({ percent, blockingCount, warningCount, statuses, onNavigate }: HealthSummarySidebarProps) {
  const readyForPublish = blockingCount === 0;

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Publish readiness</h3>
        <div className="mt-2">
          <Badge tone={readyForPublish ? "accent" : "danger"}>{readyForPublish ? "No health blockers" : "Blocked"}</Badge>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          {readyForPublish ? "Nothing in Service Health is blocking a publish." : "Resolve the blocking issue below before publishing."}
        </p>
        <p className="mt-1 text-xs text-text-muted">Based on Service Health only — open Publish for the full readiness check.</p>
      </Card>

      <Card>
        <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">Completion</h4>
        <div className="mt-2">
          <ProgressBar value={percent} label="Overall completion" />
        </div>
        <p className="mt-2 text-xs text-text-muted">
          {blockingCount} blocking, {warningCount} warning{warningCount === 1 ? "" : "s"} remaining.
        </p>
      </Card>

      <Card>
        <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">Quick navigation</h4>
        <ul className="mt-2 space-y-0.5">
          {statuses.map((status) => (
            <li key={status.key}>
              <button
                type="button"
                onClick={() => onNavigate(status.jumpTo)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-sm text-text transition-colors duration-150 hover:bg-text/7"
              >
                <span>{status.label}</span>
                <HealthDot percent={status.isMissing ? 0 : 100} topMissingLabel={status.isMissing ? status.label : undefined} />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
