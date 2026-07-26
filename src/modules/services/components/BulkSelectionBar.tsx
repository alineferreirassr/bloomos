import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";

interface BulkSelectionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClear: () => void;
  /** Leaves bulk mode entirely (distinct from `onClear`, which only empties the current selection). */
  onExit: () => void;
  className?: string;
}

/** Every placeholder action label paired with why it's disabled — labels only, no wired mutation yet (this checkpoint is UI-state only). */
const PLACEHOLDER_BULK_ACTIONS = ["Activate", "Deactivate", "Archive"];

/**
 * UI state only, per this checkpoint's explicit scope — no bulk mutation is
 * wired up yet. Each placeholder action uses the same `aria-disabled` +
 * Tooltip pattern RequirementCard already established for "disabled with an
 * explanation," so swapping in a real `onClick` later is a one-line change
 * per button, not a rewrite.
 */
export function BulkSelectionBar({ selectedCount, totalCount, onSelectAll, onClear, onExit, className = "" }: BulkSelectionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-3.5 py-2.5 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-text">
        <span>
          {selectedCount} of {totalCount} selected
        </span>
        <Button type="button" variant="ghost" onClick={onSelectAll}>
          Select all
        </Button>
        <Button type="button" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PLACEHOLDER_BULK_ACTIONS.map((label) => (
          <Tooltip key={label} content="Bulk actions are coming in a future update.">
            <Button
              type="button"
              variant="secondary"
              aria-disabled="true"
              onClick={(event) => event.preventDefault()}
              className="cursor-not-allowed opacity-45"
            >
              {label}
            </Button>
          </Tooltip>
        ))}
        <Button type="button" variant="secondary" onClick={onExit}>
          Done
        </Button>
      </div>
    </div>
  );
}
