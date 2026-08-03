import { NavChevronIcon } from "@/components/ui/icons";
import type { ServiceHealthMissingItem } from "@/lib/queries/services/types";

interface HealthMissingItemProps {
  item: ServiceHealthMissingItem;
  /** Omit entirely for a read-only context (e.g. a report) — the item then renders as plain, non-interactive text instead of a dead-looking button. */
  onSelect?: (item: ServiceHealthMissingItem) => void;
}

/**
 * Interactive only when `onSelect` is supplied — a real `<button>` (never a
 * `<div onClick>`) so it's reachable and activatable by keyboard for free,
 * with a chevron communicating "this goes somewhere" without this
 * presentational shell needing to know what that somewhere actually is
 * (that mapping belongs to whichever screen wires up `onSelect`).
 */
export function HealthMissingItem({ item, onSelect }: HealthMissingItemProps) {
  if (!onSelect) {
    return <li className="px-2 py-1.5 text-sm text-text-muted">{item.label}</li>;
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item)}
        className="group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-text transition-colors duration-150 hover:bg-text/7"
      >
        <span>{item.label}</span>
        <NavChevronIcon className="h-3.5 w-3.5 shrink-0 text-text-muted transition-transform duration-150 group-hover:translate-x-0.5" />
      </button>
    </li>
  );
}
