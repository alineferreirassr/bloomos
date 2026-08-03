"use client";

import { Card } from "@/components/ui/Card";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { ChecklistStatusBadge } from "@/modules/events/components/ChecklistStatusBadge";
import { ChecklistCategoryBadge } from "@/modules/events/components/ChecklistCategoryBadge";
import { NotePriorityBadge } from "@/modules/notes/components/NotePriorityBadge";
import { useUpdateChecklistItemStatus } from "@/modules/services/hooks/useUpdateChecklistItemStatus";
import { canOverrideEventService, type EventServiceStatus } from "@/core/workflows/eventServiceWorkflow";
import { CHECKLIST_CATEGORY_LABELS, type ChecklistCategory } from "@/core/enums/checklistCategory";
import type { ChecklistItem } from "@/types/checklistItem";
import type { ChecklistStatus } from "@/core/enums/checklistStatus";

interface TemplateExecutionSectionProps {
  eventServiceId: string;
  status: EventServiceStatus;
  checklistItems: ChecklistItem[];
}

function groupByCategory(items: ChecklistItem[]): Array<[ChecklistCategory, ChecklistItem[]]> {
  const byCategory = new Map<ChecklistCategory, ChecklistItem[]>();
  for (const item of items) {
    const bucket = byCategory.get(item.category) ?? [];
    bucket.push(item);
    byCategory.set(item.category, bucket);
  }
  return Array.from(byCategory.entries()).sort(([a], [b]) => CHECKLIST_CATEGORY_LABELS[a].localeCompare(CHECKLIST_CATEGORY_LABELS[b]));
}

/**
 * Executes the template this EventService generated — never edits it.
 * "Skipped" (the checkpoint spec's own status name) has no separate
 * `ChecklistStatus` value; it reuses the existing "cancelled" status
 * (labeled "Cancelled" everywhere else this same status already appears —
 * Event Health, the AI Ops Brief — so the action here is named "Mark
 * skipped" without introducing a second, parallel status concept).
 */
export function TemplateExecutionSection({ eventServiceId, status, checklistItems }: TemplateExecutionSectionProps) {
  const updateStatus = useUpdateChecklistItemStatus(eventServiceId);
  const readOnly = !canOverrideEventService(status);

  if (checklistItems.length === 0) {
    return (
      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Template execution</h3>
        <p className="mt-2 text-sm text-text-muted">This assignment generated no checklist items.</p>
      </Card>
    );
  }

  function actionsFor(item: ChecklistItem): ActionMenuAction[] {
    if (readOnly) return [];
    const setStatus = (next: ChecklistStatus) => () => updateStatus.mutate({ id: item.id, status: next });
    const actions: ActionMenuAction[] = [];
    if (item.status !== "in_progress" && item.status !== "completed" && item.status !== "cancelled") {
      actions.push({ label: "Mark in progress", onSelect: setStatus("in_progress") });
    }
    if (item.status !== "blocked" && item.status !== "completed" && item.status !== "cancelled") {
      actions.push({ label: "Mark blocked", onSelect: setStatus("blocked") });
    }
    if (item.status !== "completed" && item.status !== "cancelled") {
      actions.push({ label: "Complete", onSelect: setStatus("completed") });
      actions.push({ label: "Mark skipped", onSelect: setStatus("cancelled") });
    }
    if (item.status === "completed" || item.status === "cancelled" || item.status === "blocked") {
      actions.push({ label: "Reopen", onSelect: setStatus("pending") });
    }
    return actions;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-[17px] font-semibold text-text">Template execution</h3>
      {groupByCategory(checklistItems).map(([category, items]) => (
        <div key={category} className="space-y-2">
          <div className="flex items-center gap-2">
            <ChecklistCategoryBadge category={category} />
            <span className="text-xs text-text-muted">
              {items.filter((item) => item.status === "completed" || item.status === "cancelled").length} of {items.length} resolved
            </span>
          </div>
          {items.map((item) => (
            <Card key={item.id} data-testid={`template-execution-item-${item.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{item.title}</p>
                  {item.description ? <p className="mt-1 text-sm text-text-muted">{item.description}</p> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <NotePriorityBadge priority={item.priority} />
                    <ChecklistStatusBadge status={item.status} />
                    {item.due_date ? <span className="text-xs text-text-muted">Due {new Date(item.due_date).toLocaleDateString()}</span> : null}
                  </div>
                </div>
                {!readOnly && actionsFor(item).length > 0 ? <ActionMenu actions={actionsFor(item)} /> : null}
              </div>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}
