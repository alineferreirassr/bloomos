import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { TemplateBuilderData, TemplateCategoryKey } from "@/lib/queries/services/types";
import type { TemplateCategoryAdapter } from "@/modules/services/templateCategoryAdapters";

interface TemplateBuilderSidebarProps {
  data: TemplateBuilderData;
  adapters: TemplateCategoryAdapter<{ id: string }, Record<string, unknown>>[];
  onNavigateToCategory: (key: TemplateCategoryKey) => void;
}

/**
 * Everything here is derived directly from `TemplateBuilderData` — no
 * recomputation of the real Service Health Score (that stays exactly where
 * it already lives, `lib/queries/services/health.ts`, reached from the
 * Health tab). "Template completeness" is a deliberately distinct, simpler
 * metric scoped only to this screen: the share of "expected" categories
 * that have at least one row — named differently on purpose so it's never
 * mistaken for the actual publish-readiness gate (`canPublishServiceVersion`
 * only checks version status and base price, not template completeness).
 */
export function TemplateBuilderSidebar({ data, adapters, onNavigateToCategory }: TemplateBuilderSidebarProps) {
  const allCategories = data.groups.flatMap((group) => group.categories);
  const expectedCategories = allCategories.filter((category) => category.expectation === "expected");
  const expectedComplete = expectedCategories.filter((category) => category.count > 0);
  const missingRequired = expectedCategories.filter((category) => category.count === 0);
  const optionalCategories = allCategories.filter((category) => category.expectation === "optional");
  const optionalWithItems = optionalCategories.filter((category) => category.count > 0);
  const completionPercent = expectedCategories.length === 0 ? 100 : Math.round((expectedComplete.length / expectedCategories.length) * 100);

  function labelFor(key: TemplateCategoryKey): string {
    return adapters.find((adapter) => adapter.key === key)?.label ?? key;
  }

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Template Completeness</h3>
        <div className="mt-3">
          <ProgressBar value={completionPercent} label="Template completeness" />
        </div>
        <p className="mt-2 text-xs text-text-muted">
          {expectedComplete.length} of {expectedCategories.length} required categories complete
        </p>
        <p className="mt-1 text-xs text-text-muted">
          {optionalWithItems.length} of {optionalCategories.length} optional categories used
        </p>
        <p className="mt-2 text-xs text-text-muted">
          {missingRequired.length === 0 ? "All required template categories have at least one item." : `${missingRequired.length} required ${missingRequired.length === 1 ? "category is" : "categories are"} still missing.`}
        </p>
      </Card>

      {missingRequired.length > 0 ? (
        <Card>
          <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">Missing categories</h4>
          <ul className="mt-2 space-y-1">
            {missingRequired.map((category) => (
              <li key={category.key}>
                <button type="button" onClick={() => onNavigateToCategory(category.key)} className="text-sm text-accent underline underline-offset-2 hover:no-underline">
                  {labelFor(category.key)}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">Quick navigation</h4>
        <ul className="mt-2 space-y-0.5">
          {allCategories.map((category) => (
            <li key={category.key}>
              <button
                type="button"
                onClick={() => onNavigateToCategory(category.key)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-sm text-text transition-colors duration-150 hover:bg-text/7"
              >
                <span>{labelFor(category.key)}</span>
                <span className="text-xs text-text-muted">{category.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
