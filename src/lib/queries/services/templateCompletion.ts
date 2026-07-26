import type { TemplateBuilderData, TemplateCategoryKey, TemplateCompletionSummary } from "@/lib/queries/services/types";

/**
 * Short, human labels for the "expected" template categories — kept local
 * and independent from `templateCategoryAdapters.ts`'s own `label` field on
 * purpose: that file lives in `modules/services` (the presentation layer),
 * and the query layer never imports from it, the same layering choice
 * `health.ts` already makes for its own `missing[].label` strings. Only
 * covers the 5 categories that can ever be "expected" (see
 * `getTemplateBuilder`'s group assembly) — every other key never appears in
 * `missingRequiredCategories`.
 */
const EXPECTED_CATEGORY_LABELS: Partial<Record<TemplateCategoryKey, string>> = {
  checklistItems: "Checklist",
  timelineItems: "Timeline",
  questionnaireQuestions: "Questionnaire",
  teamRoleRequirements: "Team roles",
  budgetLines: "Budget",
};

/**
 * The exact formula `TemplateBuilderSidebar` renders as "Template
 * Completeness" — reproduced here (not imported, since that component lives
 * in `modules/services`) so a Publish Preview can show the same number the
 * Template Builder tab already showed, without the query layer reaching
 * into a UI component or the UI recomputing readiness itself.
 */
export function computeTemplateCompletion(builder: TemplateBuilderData): TemplateCompletionSummary {
  const allCategories = builder.groups.flatMap((group) => group.categories);
  const expected = allCategories.filter((category) => category.expectation === "expected");
  const expectedComplete = expected.filter((category) => category.count > 0);
  const missing = expected.filter((category) => category.count === 0);
  const optional = allCategories.filter((category) => category.expectation === "optional");
  const optionalUsed = optional.filter((category) => category.count > 0);

  return {
    percent: expected.length === 0 ? 100 : Math.round((expectedComplete.length / expected.length) * 100),
    requiredComplete: expectedComplete.length,
    requiredTotal: expected.length,
    optionalUsed: optionalUsed.length,
    optionalTotal: optional.length,
    missingRequiredCategories: missing.map((category) => EXPECTED_CATEGORY_LABELS[category.key] ?? category.key),
  };
}
