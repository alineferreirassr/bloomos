"use client";

import { memo, type HTMLAttributes, type ReactNode } from "react";
import { TemplateItemRow } from "@/modules/services/components/TemplateItemRow";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { GripIcon } from "@/components/ui/icons";
import type { ActionMenuAction } from "@/components/ui/ActionMenu";
import type { TemplateCategoryAdapter } from "@/modules/services/templateCategoryAdapters";

interface TemplateCategoryItemRowProps<TRow extends { id: string }, TInput extends Record<string, unknown>> {
  adapter: TemplateCategoryAdapter<TRow, TInput>;
  row: TRow;
  position: number;
  total: number;
  /** Archived Service or permission denied — read-only, but not because of the published-version invariant, so no LockIcon Tooltip is shown (the Inspector's own read-only banner explains why instead). */
  disabled: boolean;
  /** The version itself is published — TemplateItemRow's own LockIcon + "published and can no longer be edited" Tooltip covers this case specifically. */
  locked: boolean;
  /**
   * These all take `row` as an argument rather than being pre-bound
   * closures — `TemplateCategoryList` passes the exact same stable
   * (`useCallback`'d) function to every row, so this component's own
   * `memo()` wrapper actually bails out for untouched siblings when one row
   * changes, instead of every row receiving a fresh closure identity on
   * every render of the list.
   */
  onOpenInspector: (row: TRow) => void;
  onDelete: (row: TRow) => void;
  onInlineChange: (row: TRow, value: string | boolean) => void;
  onMoveUp: (row: TRow) => void;
  onMoveDown: (row: TRow) => void;
  dragHandleProps?: HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  saving?: boolean;
  error?: string;
}

/**
 * The one place every category's row-level interaction (inline field,
 * inspector trigger, reorder, delete) comes together over the shared
 * `TemplateItemRow` shell — no category renders its own row markup, only
 * supplies content through `adapter`.
 */
function TemplateCategoryItemRowImpl<TRow extends { id: string }, TInput extends Record<string, unknown>>({
  adapter,
  row,
  position,
  total,
  disabled,
  locked,
  onOpenInspector,
  onDelete,
  onInlineChange,
  onMoveUp,
  onMoveDown,
  dragHandleProps,
  isDragging,
  saving,
  error,
}: TemplateCategoryItemRowProps<TRow, TInput>) {
  const readOnly = disabled || locked;
  const metadata = adapter.toRowMetadata?.(row) ?? [];
  const inlineField = adapter.inlineFieldName ? adapter.fields.find((field) => field.name === adapter.inlineFieldName) : undefined;

  let inlineFieldNode: ReactNode = null;
  if (inlineField && !readOnly) {
    const rawValue = (row as unknown as Record<string, unknown>)[inlineField.name];
    if (inlineField.kind === "boolean") {
      inlineFieldNode = (
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          <Checkbox checked={Boolean(rawValue)} onChange={(event) => onInlineChange(row, event.target.checked)} aria-label={inlineField.label} />
          {inlineField.label}
        </label>
      );
    } else if (inlineField.kind === "number") {
      inlineFieldNode = (
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          {inlineField.label}
          <Input
            type="number"
            className="w-16 py-1"
            value={String(rawValue ?? "")}
            aria-label={inlineField.label}
            onChange={(event) => onInlineChange(row, event.target.value)}
          />
        </label>
      );
    }
  }

  const actions: ActionMenuAction[] = [];
  if (adapter.supportsReorder && !readOnly) {
    if (position > 0) actions.push({ label: "Move up", onSelect: () => onMoveUp(row) });
    if (position < total - 1) actions.push({ label: "Move down", onSelect: () => onMoveDown(row) });
  }
  if (!readOnly) actions.push({ label: "Delete", onSelect: () => onDelete(row), destructive: true });

  return (
    <div className={isDragging ? "opacity-50" : undefined}>
      <TemplateItemRow
        dragHandle={
          adapter.supportsReorder && !readOnly ? (
            <div {...dragHandleProps} role="button" tabIndex={0} aria-label={`Reorder ${adapter.toRowLabel(row)}`} className="touch-none">
              <GripIcon className="h-4 w-4" />
            </div>
          ) : undefined
        }
        label={adapter.toRowLabel(row)}
        description={adapter.toRowDescription?.(row) ?? undefined}
        metadata={
          metadata.length > 0 ? (
            <>
              {metadata.map((badge, index) => (
                <Badge key={index} tone={badge.tone ?? "neutral"}>
                  {badge.label}
                </Badge>
              ))}
            </>
          ) : undefined
        }
        inlineField={inlineFieldNode}
        inspectorTrigger={
          <Button type="button" variant="ghost" onClick={() => onOpenInspector(row)}>
            {readOnly ? "View" : "Edit"}
          </Button>
        }
        actions={actions}
        saving={saving}
        error={error}
        disabled={disabled}
        locked={locked}
      />
    </div>
  );
}

/** `memo`'s type is erased for generic components — this cast restores the generic call signature for callers, matching the same pattern already used for other memoized generic rows (ServiceCard/ServiceListRow, Checkpoint 3). */
export const TemplateCategoryItemRow = memo(TemplateCategoryItemRowImpl) as typeof TemplateCategoryItemRowImpl;
