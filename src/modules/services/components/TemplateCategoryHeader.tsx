"use client";

import { RequirementCard, type RequirementCardVariant } from "@/modules/services/components/RequirementCard";
import { TemplateExpectationIndicator } from "@/modules/services/components/TemplateExpectationIndicator";
import { ChevronDownIcon } from "@/components/ui/icons";
import type { BadgeTone } from "@/components/ui/Badge";
import type { TemplateCategoryData } from "@/lib/queries/services/types";

interface TemplateCategoryHeaderProps {
  label: string;
  expectation: TemplateCategoryData["expectation"];
  count: number;
  expanded: boolean;
  onToggle: () => void;
  /** Only set for the 5 categories RequirementCard's icon vocabulary already covers — see templateCategoryAdapters.ts. */
  requirementVariant?: RequirementCardVariant;
}

function expectationStatus(expectation: TemplateCategoryData["expectation"], count: number): { label: string; tone: BadgeTone } {
  if (count > 0) return { label: String(count), tone: "accent" };
  if (expectation === "expected") return { label: "Expected", tone: "outline" };
  return { label: "Optional", tone: "neutral" };
}

/**
 * The clickable expand/collapse trigger for one category. The 5 categories
 * matching a `RequirementCardVariant` (inventory/purchase/budget/team/vendor)
 * reuse that shell so a Service's operational-resource vocabulary looks the
 * same at catalog-definition time (here) as it does at booking-fulfillment
 * time (EventServiceWorkspace, a later checkpoint) — every other category
 * uses the plain header, since RequirementCard has no icon for it.
 */
export function TemplateCategoryHeader({ label, expectation, count, expanded, onToggle, requirementVariant }: TemplateCategoryHeaderProps) {
  if (requirementVariant) {
    return (
      <RequirementCard
        variant={requirementVariant}
        title={label}
        status={expectationStatus(expectation, count)}
        detail={count === 0 && expectation === "expected" ? "Missing — usually expected" : undefined}
        primaryAction={{ label: expanded ? "Collapse" : "Expand", onClick: onToggle }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-border px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-text/5"
    >
      <span className="flex items-center gap-2">
        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-150 ${expanded ? "" : "-rotate-90"}`} />
        <span className="font-serif text-sm font-semibold text-text">{label}</span>
      </span>
      <TemplateExpectationIndicator expectation={expectation} count={count} />
    </button>
  );
}
