"use client";

import { useState } from "react";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge } from "@/components/ui/Badge";
import { ChecklistStatusBadge } from "@/modules/events/components/ChecklistStatusBadge";
import { ChecklistCategoryBadge } from "@/modules/events/components/ChecklistCategoryBadge";
import { NotePriorityBadge } from "@/modules/notes/components/NotePriorityBadge";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { formatEventDate } from "@/modules/events/dateFormat";
import { isChecklistItemOverdue } from "@/modules/events/checklistStats";
import { ASSIGNED_TYPE_LABELS } from "@/core/enums/assignedType";
import { completeChecklistItem, updateChecklistItem, updateChecklistItemStatus } from "@/lib/data";
import type { ChecklistItem } from "@/types/checklistItem";

interface ChecklistItemRowProps {
  item: ChecklistItem;
  /** 1-based rank in the event's full sort order — independent of any active filter/grouping. */
  sortPosition: number;
  readOnly: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: () => void;
}

export function ChecklistItemRow({
  item,
  sortPosition,
  readOnly,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  onChanged,
}: ChecklistItemRowProps) {
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const overdue = isChecklistItemOverdue(item);
  const isAssigned = item.assigned_type !== "unknown" || item.assigned_name !== null;

  const runAction = async (action: () => Promise<{ success: boolean; error?: string }>) => {
    setPending(true);
    setActionError(null);
    const result = await action();
    setPending(false);
    if (!result.success) {
      setActionError(result.error ?? "Something went wrong.");
      return;
    }
    onChanged();
  };

  const actions: ActionMenuAction[] = [];
  if (!readOnly) {
    actions.push({ label: "Edit", onSelect: onEdit });

    if (item.status !== "in_progress" && item.status !== "completed" && item.status !== "cancelled") {
      actions.push({
        label: "Mark in progress",
        onSelect: () => runAction(() => updateChecklistItemStatus(item.id, "in_progress")),
      });
    }
    if (item.status !== "blocked" && item.status !== "completed" && item.status !== "cancelled") {
      actions.push({
        label: "Mark blocked",
        onSelect: () => runAction(() => updateChecklistItemStatus(item.id, "blocked")),
      });
    }
    if (item.status !== "completed" && item.status !== "cancelled") {
      actions.push({ label: "Complete", onSelect: () => runAction(() => completeChecklistItem(item.id)) });
      actions.push({
        label: "Cancel item",
        onSelect: () => runAction(() => updateChecklistItemStatus(item.id, "cancelled")),
      });
    }
    if (item.status === "completed" || item.status === "cancelled" || item.status === "blocked") {
      actions.push({
        label: "Reopen",
        onSelect: () => runAction(() => updateChecklistItemStatus(item.id, "pending")),
      });
    }
    if (isAssigned) {
      actions.push({
        label: "Clear assignment",
        onSelect: () =>
          runAction(() =>
            updateChecklistItem(item.id, {
              title: item.title,
              description: item.description,
              category: item.category,
              priority: item.priority,
              due_date: item.due_date,
              assigned_type: "unknown",
              assigned_id: null,
              assigned_name: null,
            }),
          ),
      });
    }
    if (item.status !== "completed") {
      actions.push({ label: "Delete", onSelect: onDelete, destructive: true });
    }
  }

  return (
    <LuxuryCard data-testid={`checklist-item-${item.id}`} className={overdue ? "ring-1 ring-danger/40 ring-inset" : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted">#{sortPosition}</span>
            <p className="text-sm font-medium text-text">{item.title}</p>
            {overdue ? <Badge tone="danger">Overdue</Badge> : null}
          </div>
          {item.description ? <p className="mt-1 text-sm text-text-muted">{item.description}</p> : null}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ChecklistCategoryBadge category={item.category} />
            <NotePriorityBadge priority={item.priority} />
            <ChecklistStatusBadge status={item.status} />
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-text-muted sm:grid-cols-4">
            <div>
              <dt className="text-text-muted/70">Due date</dt>
              <dd className={overdue ? "font-medium text-danger" : "text-text"}>{formatEventDate(item.due_date)}</dd>
            </div>
            <div>
              <dt className="text-text-muted/70">Assigned to</dt>
              <dd className="text-text">
                {isAssigned ? `${item.assigned_name ?? "—"} (${ASSIGNED_TYPE_LABELS[item.assigned_type]})` : "Unassigned"}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted/70">Completed</dt>
              <dd className="text-text">
                {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!readOnly ? (
            <div className="flex flex-col">
              <button
                type="button"
                aria-label="Move up"
                disabled={!canMoveUp || pending}
                onClick={onMoveUp}
                className="flex h-5 w-6 items-center justify-center text-text-muted transition-colors duration-150 hover:text-text disabled:pointer-events-none disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={!canMoveDown || pending}
                onClick={onMoveDown}
                className="flex h-5 w-6 items-center justify-center text-text-muted transition-colors duration-150 hover:text-text disabled:pointer-events-none disabled:opacity-30"
              >
                ▼
              </button>
            </div>
          ) : null}
          {!readOnly ? <ActionMenu actions={actions} /> : null}
        </div>
      </div>
      {actionError ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {actionError}
        </p>
      ) : null}
    </LuxuryCard>
  );
}
