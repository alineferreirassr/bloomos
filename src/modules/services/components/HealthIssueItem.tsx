"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ALL_TEMPLATE_CATEGORY_ADAPTERS } from "@/modules/services/templateCategoryAdapters";
import type { HealthCategoryStatus } from "@/modules/services/serviceHealthNavigation";
import type { ServiceHealthMissingItem } from "@/lib/queries/services/types";

interface HealthIssueItemProps {
  /** Always an `isMissing: true` status — the caller (HealthIssueList) only ever renders actual issues here. */
  status: HealthCategoryStatus;
  onNavigate: (jumpTo: ServiceHealthMissingItem["jumpTo"]) => void;
}

function affectedCategoryLabel(status: HealthCategoryStatus): string {
  const jumpTo = status.jumpTo;
  if (jumpTo.kind === "templateCategory") {
    return ALL_TEMPLATE_CATEGORY_ADAPTERS.find((adapter) => adapter.key === jumpTo.category)?.label ?? status.label;
  }
  return "Service details";
}

function description(status: HealthCategoryStatus): string {
  if (status.jumpTo.kind === "draftVersionForm") {
    return "Set a base price greater than $0 before this Service can be published.";
  }
  return `Add at least one item to ${status.label} to complete this category.`;
}

export function HealthIssueItem({ status, onNavigate }: HealthIssueItemProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text">{status.label}</p>
          <p className="mt-0.5 text-xs text-text-muted">{description(status)}</p>
          <p className="mt-1 text-xs text-text-muted">Affects: {affectedCategoryLabel(status)}</p>
        </div>
        <Badge tone={status.severity === "blocking" ? "danger" : "warning"}>{status.severity === "blocking" ? "Blocking" : "Recommended"}</Badge>
      </div>
      <div className="mt-3">
        <Button type="button" variant="secondary" onClick={() => onNavigate(status.jumpTo)}>
          {`Review: ${status.label}`}
        </Button>
      </div>
    </Card>
  );
}
