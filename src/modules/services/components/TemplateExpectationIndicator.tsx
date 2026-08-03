import { Badge } from "@/components/ui/Badge";
import type { TemplateCategoryData } from "@/lib/queries/services/types";

interface TemplateExpectationIndicatorProps {
  expectation: TemplateCategoryData["expectation"];
  count: number;
  className?: string;
}

/**
 * Three states, expressed only through Badge's outline/accent/neutral
 * vocabulary — never a red/yellow/green tier: populated categories are
 * accent-filled with their count; empty-but-expected is an outline "Expected"
 * (a nudge, not an error); empty-and-optional is a quiet neutral "Optional".
 */
export function TemplateExpectationIndicator({ expectation, count, className = "" }: TemplateExpectationIndicatorProps) {
  if (count > 0) {
    return (
      <Badge tone="accent" className={className}>
        {count}
      </Badge>
    );
  }

  if (expectation === "expected") {
    return (
      <Badge tone="outline" className={className}>
        Expected
      </Badge>
    );
  }

  return (
    <Badge tone="neutral" className={className}>
      Optional
    </Badge>
  );
}
