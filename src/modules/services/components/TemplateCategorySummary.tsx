import type { TemplateCategoryData } from "@/lib/queries/services/types";

interface TemplateCategorySummaryProps {
  expectation: TemplateCategoryData["expectation"];
  count: number;
}

/** The category's own "Missing required indicator" / "Progress summary" line — the TemplateExpectationIndicator badge already carries the count/expected/optional distinction visually; this is the plain-language sentence next to it. */
export function TemplateCategorySummary({ expectation, count }: TemplateCategorySummaryProps) {
  if (count > 0) {
    return (
      <p className="text-xs text-text-muted">
        {count} {count === 1 ? "item" : "items"}
      </p>
    );
  }
  if (expectation === "expected") {
    return <p className="text-xs text-danger">Missing — this category is usually expected.</p>;
  }
  return <p className="text-xs text-text-muted">No items yet — optional.</p>;
}
