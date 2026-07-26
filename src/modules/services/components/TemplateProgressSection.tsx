"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CHECKLIST_CATEGORY_LABELS, type ChecklistCategory } from "@/core/enums/checklistCategory";
import { calculatePercentage } from "@/lib/money";
import type { ChecklistItem } from "@/types/checklistItem";

interface TemplateProgressSectionProps {
  checklistItems: ChecklistItem[];
}

/** Completed or cancelled ("skipped") both count as resolved — an item that was deliberately skipped is no longer pending work, the same "a decision was made either way" logic the vendor requirement's declined/confirmed split already uses. */
function isResolved(item: ChecklistItem): boolean {
  return item.status === "completed" || item.status === "cancelled";
}

interface CategoryProgress {
  category: ChecklistCategory;
  resolved: number;
  total: number;
}

function computeCategoryProgress(items: ChecklistItem[]): CategoryProgress[] {
  const byCategory = new Map<ChecklistCategory, ChecklistItem[]>();
  for (const item of items) {
    const bucket = byCategory.get(item.category) ?? [];
    bucket.push(item);
    byCategory.set(item.category, bucket);
  }
  return Array.from(byCategory.entries())
    .map(([category, categoryItems]) => ({
      category,
      resolved: categoryItems.filter(isResolved).length,
      total: categoryItems.length,
    }))
    .sort((a, b) => CHECKLIST_CATEGORY_LABELS[a.category].localeCompare(CHECKLIST_CATEGORY_LABELS[b.category]));
}

/**
 * "Estimated completion" is the latest `due_date` among still-pending items
 * — a real derived value from data that already exists, never a fabricated
 * time estimate (no effort/duration field exists on ChecklistItem to
 * estimate from). Returns null when every remaining item is undated or none
 * remain.
 */
function estimateCompletionDate(items: ChecklistItem[]): string | null {
  const dueDates = items
    .filter((item) => !isResolved(item) && item.due_date !== null)
    .map((item) => item.due_date as string);
  if (dueDates.length === 0) return null;
  return dueDates.reduce((latest, date) => (date > latest ? date : latest));
}

export function TemplateProgressSection({ checklistItems }: TemplateProgressSectionProps) {
  const { overall, categories, remaining, blocked, estimatedCompletion } = useMemo(() => {
    const resolvedCount = checklistItems.filter(isResolved).length;
    return {
      overall: { resolved: resolvedCount, total: checklistItems.length },
      categories: computeCategoryProgress(checklistItems),
      remaining: checklistItems.filter((item) => !isResolved(item)).length,
      blocked: checklistItems.filter((item) => item.status === "blocked").length,
      estimatedCompletion: estimateCompletionDate(checklistItems),
    };
  }, [checklistItems]);

  const overallPercent = calculatePercentage(overall.resolved, overall.total);

  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Progress</h3>
      <div className="mt-3">
        <ProgressBar value={overallPercent} label="Overall completion" />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-text-muted">Remaining</dt>
          <dd className="text-text">{remaining}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Blocked</dt>
          <dd className={blocked > 0 ? "font-medium text-danger" : "text-text"}>{blocked}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Estimated completion</dt>
          <dd className="text-text">{estimatedCompletion ? new Date(estimatedCompletion).toLocaleDateString() : "—"}</dd>
        </div>
      </dl>

      {categories.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-text-muted">By category</p>
          {categories.map(({ category, resolved, total }) => (
            <div key={category} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 text-text-muted">{CHECKLIST_CATEGORY_LABELS[category]}</span>
              <ProgressBar value={calculatePercentage(resolved, total)} className="flex-1" />
              <span className="w-14 shrink-0 text-right text-xs text-text-muted">
                {resolved}/{total}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
