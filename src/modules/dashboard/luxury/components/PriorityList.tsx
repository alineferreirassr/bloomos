export interface PriorityItemData {
  id: string;
  title: string;
  dueLabel: string;
  completed: boolean;
  urgent: boolean;
}

/**
 * Checkpoint 19, Step 6, then the Today's Work presentational remediation —
 * the Owner Dashboard's own "My Priorities" list: a status/priority dot
 * (never a checkbox shape — this list has no toggle behavior today, so it
 * must not look like one), title, and a due label colored rose when
 * urgent/overdue, muted once completed.
 */
export function PriorityList({ items }: { items: PriorityItemData[] }) {
  return (
    <ul className="space-y-3.5">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <span
            className="mt-1.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center"
            role="img"
            aria-label={item.completed ? "Completed" : item.urgent ? "Urgent priority" : "Priority"}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${item.completed ? "bg-luxury-success" : item.urgent ? "bg-luxury-critical" : "bg-luxury-border"}`}
              aria-hidden="true"
            />
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
