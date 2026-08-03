"use client";

import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RequirementCard } from "@/modules/services/components/RequirementCard";
import type { HealthCategoryStatus } from "@/modules/services/serviceHealthNavigation";
import type { ServiceHealthMissingItem } from "@/lib/queries/services/types";

interface HealthCategoryCardProps {
  status: HealthCategoryStatus;
  onNavigate: (jumpTo: ServiceHealthMissingItem["jumpTo"]) => void;
}

/**
 * One row of the Category Breakdown. `score`/`completion` are the same
 * number (0 or 100) — each of health.ts's signals is itself a binary
 * pass/fail check (`draft.base_price_minor > 0`, `checklist.length > 0`,
 * ...), never a fractional weight, so representing it as 0%/100% here is
 * faithful to the underlying computation, not an invented approximation.
 * Reuses `RequirementCard` for the 5 categories that share its existing
 * icon vocabulary (team/budget/vendor/inventory/purchase — not
 * coincidentally the same 5 domains it was built for in the Template
 * Builder); the other 4 (base price, checklist, timeline, questionnaire)
 * have no matching variant, so they get an equivalent plain Card instead of
 * forcing a mismatched icon.
 */
export function HealthCategoryCard({ status, onNavigate }: HealthCategoryCardProps) {
  const score = status.isMissing ? 0 : 100;
  const statusTone: BadgeTone = status.isMissing ? (status.severity === "blocking" ? "danger" : "warning") : "accent";
  const statusLabel = status.isMissing ? (status.severity === "blocking" ? "Blocking" : "Needs attention") : "Complete";
  const blockingCount = status.isMissing && status.severity === "blocking" ? 1 : 0;
  const warningCount = status.isMissing && status.severity === "warning" ? 1 : 0;
  const actionVerb = status.isMissing ? "Fix now" : "Review";
  // RequirementCard's primaryAction has no separate aria-label slot, so the
  // category name goes into the visible button text itself — several of
  // these cards render on one page, and a list of identically-labeled
  // "Review" buttons is ambiguous to a screen reader.
  const actionLabel = `${actionVerb}: ${status.label}`;

  const detail = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
      <span>Score {score}%</span>
      <span>Blocking {blockingCount}</span>
      <span>Warnings {warningCount}</span>
    </div>
  );

  if (status.requirementVariant) {
    return (
      <RequirementCard
        variant={status.requirementVariant}
        title={status.label}
        status={{ label: statusLabel, tone: statusTone }}
        detail={detail}
        primaryAction={{ label: actionLabel, onClick: () => onNavigate(status.jumpTo) }}
      />
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text">{status.label}</p>
          <div className="mt-1">{detail}</div>
        </div>
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>
      <div className="mt-3">
        <ProgressBar value={score} label={`${status.label} completion`} />
      </div>
      <div className="mt-3">
        <Button type="button" variant="secondary" onClick={() => onNavigate(status.jumpTo)}>
          {actionLabel}
        </Button>
      </div>
    </Card>
  );
}
