import type { ReactNode } from "react";
import { ChecklistCategoryBadge } from "@/modules/events/components/ChecklistCategoryBadge";
import type { ChecklistCategory } from "@/core/enums/checklistCategory";
import type { ChecklistItem } from "@/types/checklistItem";

interface ChecklistGroupProps {
  category: ChecklistCategory;
  items: ChecklistItem[];
  renderRow: (item: ChecklistItem) => ReactNode;
}

/** Native <details>/<summary> — accessible, collapsible, no library. */
export function ChecklistGroup({ category, items, renderRow }: ChecklistGroupProps) {
  const completed = items.filter((item) => item.status === "completed").length;

  return (
    <details open className="rounded-md border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <ChecklistCategoryBadge category={category} />
          <span className="text-xs text-text-muted">
            {items.length} item{items.length === 1 ? "" : "s"} · {completed}/{items.length} complete
          </span>
        </div>
      </summary>
      <div className="space-y-2 border-t border-border p-3">{items.map(renderRow)}</div>
    </details>
  );
}
