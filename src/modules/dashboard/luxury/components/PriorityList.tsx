import { LuxuryCheckedCircleIcon, LuxuryUncheckedCircleIcon } from "@/modules/dashboard/luxury/luxuryIcons";

export interface PriorityItemData {
  id: string;
  title: string;
  dueLabel: string;
  completed: boolean;
  urgent: boolean;
}

/** Checkpoint 19, Step 6 — the Owner Dashboard's own "My Priorities" list: a circle marker, title, and a due label colored rose when urgent/overdue, muted once completed — matches the approved Owner reference image exactly. */
export function PriorityList({ items }: { items: PriorityItemData[] }) {
  return (
    <ul className="space-y-3.5">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-luxury-rose" aria-hidden="true">
            {item.completed ? <LuxuryCheckedCircleIcon className="h-4.5 w-4.5" /> : <LuxuryUncheckedCircleIcon className="h-4.5 w-4.5 text-luxury-border" />}
          </span>
          <span className="min-w-0">
            <span className={`block text-luxury-body font-medium ${item.completed ? "text-luxury-text-muted line-through" : "text-luxury-text"}`}>{item.title}</span>
            <span className={`block text-luxury-small ${item.completed ? "text-luxury-text-muted" : item.urgent ? "text-luxury-critical" : "text-luxury-text-muted"}`}>{item.dueLabel}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
