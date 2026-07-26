"use client";

import { HealthIssueItem } from "@/modules/services/components/HealthIssueItem";
import { HealthEmptyState } from "@/modules/services/components/HealthEmptyState";
import type { HealthCategoryStatus } from "@/modules/services/serviceHealthNavigation";
import type { ServiceHealthMissingItem } from "@/lib/queries/services/types";

interface HealthIssueListProps {
  blocking: HealthCategoryStatus[];
  warnings: HealthCategoryStatus[];
  onNavigate: (jumpTo: ServiceHealthMissingItem["jumpTo"]) => void;
}

/**
 * Blocking / Warnings / Informational, kept structurally separate per the
 * spec even though no health signal today ever produces a purely
 * informational notice (every signal health.ts computes is either the one
 * publish blocker or a completeness warning) — the empty "Informational"
 * case is intentional, not a gap, and needs no placeholder copy since
 * nothing is ever missing from it.
 */
export function HealthIssueList({ blocking, warnings, onNavigate }: HealthIssueListProps) {
  const hasIssues = blocking.length > 0 || warnings.length > 0;

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-[17px] font-semibold text-text">Issues</h3>
      {!hasIssues ? (
        <HealthEmptyState />
      ) : (
        <>
          {blocking.length > 0 ? (
            <div>
              <h4 className="text-xs font-semibold tracking-wide text-danger uppercase">Blocking</h4>
              <ul className="mt-2 space-y-2">
                {blocking.map((status) => (
                  <li key={status.key}>
                    <HealthIssueItem status={status} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {warnings.length > 0 ? (
            <div>
              <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">Warnings</h4>
              <ul className="mt-2 space-y-2">
                {warnings.map((status) => (
                  <li key={status.key}>
                    <HealthIssueItem status={status} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
