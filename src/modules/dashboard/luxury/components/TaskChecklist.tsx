"use client";

import { LuxuryCheckedCircleIcon, LuxuryUncheckedCircleIcon } from "@/modules/dashboard/luxury/luxuryIcons";
import { StatusBadge } from "@/modules/dashboard/luxury/components/StatusBadge";

export interface TaskChecklistItemData {
  id: string;
  title: string;
  timeLabel: string | null;
  completed: boolean;
  /** Present only when this checkbox is real (the current member/client may toggle it); absent renders a read-only status pill instead — never a checkbox that silently does nothing on click. */
  onToggle?: () => void;
}

/** Checkpoint 19, Step 3/7/9 — the shared checkbox-list shape behind the Team Dashboard's "My Tasks" and the Client Dashboard's "Planning Checklist." A row is only ever rendered as an interactive checkbox when `onToggle` is real. */
export function TaskChecklist({ items }: { items: TaskChecklistItemData[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3">
          {item.onToggle ? (
            <button
              type="button"
              onClick={item.onToggle}
              aria-pressed={item.completed}
              aria-label={item.completed ? `Mark "${item.title}" incomplete` : `Mark "${item.title}" complete`}
              className="shrink-0 text-luxury-rose focus-visible:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)]"
            >
              {item.completed ? <LuxuryCheckedCircleIcon className="h-5 w-5" /> : <LuxuryUncheckedCircleIcon className="h-5 w-5 text-luxury-border" />}
            </button>
          ) : (
            <span className="shrink-0 text-luxury-rose" aria-hidden="true">
              {item.completed ? <LuxuryCheckedCircleIcon className="h-5 w-5" /> : <LuxuryUncheckedCircleIcon className="h-5 w-5 text-luxury-border" />}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-luxury-body font-medium ${item.completed ? "text-luxury-text-muted line-through" : "text-luxury-text"}`}>{item.title}</span>
            {item.timeLabel ? <span className="block text-luxury-small text-luxury-text-muted">{item.timeLabel}</span> : null}
          </span>
          <StatusBadge label={item.completed ? "Completed" : "Pending"} tone={item.completed ? "success" : "pending"} />
        </li>
      ))}
    </ul>
  );
}
