"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { ScheduleStatusBadge } from "@/modules/events/components/ScheduleStatusBadge";
import { ScheduleCategoryBadge } from "@/modules/events/components/ScheduleCategoryBadge";
import { updateScheduleItem, updateScheduleItemStatus } from "@/lib/data";
import type { EventScheduleItem } from "@/types/eventScheduleItem";

interface ScheduleItemRowProps {
  item: EventScheduleItem;
  /** 1-based rank in the event's full sort order — independent of any active filter. */
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

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  if (start && end) return `${start}–${end}`;
  return start ?? end ?? "—";
}

export function ScheduleItemRow({
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
}: ScheduleItemRowProps) {
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const delayed = item.status === "delayed";

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

    if (item.status !== "confirmed" && item.status !== "completed" && item.status !== "cancelled") {
      actions.push({
        label: "Mark confirmed",
        onSelect: () => runAction(() => updateScheduleItemStatus(item.id, "confirmed")),
      });
    }
    if (item.status !== "delayed" && item.status !== "completed" && item.status !== "cancelled") {
      actions.push({
        label: "Mark delayed",
        onSelect: () => runAction(() => updateScheduleItemStatus(item.id, "delayed")),
      });
    }
    if (item.status !== "completed" && item.status !== "cancelled") {
      actions.push({
        label: "Mark completed",
        onSelect: () => runAction(() => updateScheduleItemStatus(item.id, "completed")),
      });
      actions.push({
        label: "Cancel item",
        onSelect: () => runAction(() => updateScheduleItemStatus(item.id, "cancelled")),
      });
    }
    if (item.assigned_to !== null) {
      actions.push({
        label: "Clear assignment",
        onSelect: () =>
          runAction(() =>
            updateScheduleItem(item.id, {
              title: item.title,
              description: item.description,
              start_time: item.start_time,
              end_time: item.end_time,
              location: item.location,
              assigned_to: null,
              category: item.category,
            }),
          ),
      });
    }
    actions.push({ label: "Delete", onSelect: onDelete, destructive: true });
  }

  return (
    <Card data-testid={`schedule-item-${item.id}`} className={delayed ? "border-danger/50" : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted">#{sortPosition}</span>
            <span className="font-serif text-sm font-semibold text-text">{formatTimeRange(item.start_time, item.end_time)}</span>
            <p className="text-sm font-medium text-text">{item.title}</p>
            {delayed ? <Badge tone="danger">Delayed</Badge> : null}
          </div>
          {item.description ? <p className="mt-1 text-sm text-text-muted">{item.description}</p> : null}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ScheduleCategoryBadge category={item.category} />
            <ScheduleStatusBadge status={item.status} />
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-text-muted sm:grid-cols-3">
            <div>
              <dt className="text-text-muted/70">Location</dt>
              <dd className="text-text">{item.location ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-muted/70">Assigned to</dt>
              <dd className="text-text">{item.assigned_to ?? "Unassigned"}</dd>
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
    </Card>
  );
}
