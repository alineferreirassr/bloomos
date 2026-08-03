"use client";

import { useCallback, useState, type HTMLAttributes, type ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { TemplateCategoryItemRow } from "@/modules/services/components/TemplateCategoryItemRow";
import type { TemplateCategoryAdapter } from "@/modules/services/templateCategoryAdapters";

function moveItem<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const copy = array.slice();
  const [item] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, item);
  return copy;
}

interface DraggableDroppableRowProps {
  id: string;
  disabled: boolean;
  children: (props: { dragHandleProps: HTMLAttributes<HTMLDivElement>; isDragging: boolean }) => ReactNode;
}

/**
 * `@dnd-kit/sortable` isn't installed — this codebase's one existing DnD
 * precedent (the Commercial/Operational Pipeline boards) uses plain
 * `@dnd-kit/core` `useDraggable`/`useDroppable` directly, so this mirrors
 * that exact pattern rather than adding a new dependency for one feature.
 * Each row is simultaneously the drag source AND a drop target (for
 * whichever row is being dragged over it) — merging both hooks' refs onto
 * one element is what makes "drop row A onto row B" resolvable to an index.
 */
function DraggableDroppableRow({ id, disabled, children }: DraggableDroppableRowProps) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id, disabled });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id, disabled });

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={isOver && !isDragging ? "rounded-md ring-2 ring-accent" : undefined}
    >
      {children({ dragHandleProps: { ...attributes, ...listeners }, isDragging })}
    </div>
  );
}

interface TemplateCategoryListProps<TRow extends { id: string }, TInput extends Record<string, unknown>> {
  adapter: TemplateCategoryAdapter<TRow, TInput>;
  rows: TRow[];
  disabled: boolean;
  locked: boolean;
  onOpenInspector: (row: TRow) => void;
  onDelete: (row: TRow) => void;
  onInlineChange: (row: TRow, value: string | boolean) => void;
  onReorder: (orderedRows: TRow[]) => void;
  pendingRowId?: string;
  rowErrors?: Record<string, string>;
}

/**
 * Owns reordering only — create/update/delete mutation calls happen one
 * level up (`TemplateCategorySection`, where the mutation hooks are
 * actually called, exactly once per category, never per row). Pointer and
 * keyboard (`KeyboardSensor`) drag both go through the same `DndContext`;
 * "Move up"/"Move down" (rendered by `TemplateCategoryItemRow` itself) are
 * the primary, always-reliable keyboard-accessible path, since coordinate-
 * based keyboard dragging in a tightly packed vertical list without
 * `@dnd-kit/sortable`'s list-aware collision strategy can behave
 * unpredictably — both paths funnel through this same `handleReorder`, so
 * screen-reader announcement and the actual mutation call never diverge
 * between them.
 */
export function TemplateCategoryList<TRow extends { id: string }, TInput extends Record<string, unknown>>({
  adapter,
  rows,
  disabled,
  locked,
  onOpenInspector,
  onDelete,
  onInlineChange,
  onReorder,
  pendingRowId,
  rowErrors,
}: TemplateCategoryListProps<TRow, TInput>) {
  const [announcement, setAnnouncement] = useState("");
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const dragDisabled = disabled || locked || !adapter.supportsReorder;

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      const row = rows[fromIndex];
      const reordered = moveItem(rows, fromIndex, toIndex);
      setAnnouncement(`Moved "${adapter.toRowLabel(row)}" to position ${toIndex + 1} of ${rows.length}.`);
      onReorder(reordered);
    },
    [rows, adapter, onReorder],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const fromIndex = rows.findIndex((row) => row.id === active.id);
      const toIndex = rows.findIndex((row) => row.id === over.id);
      handleReorder(fromIndex, toIndex);
    },
    [rows, handleReorder],
  );

  const handleMoveUp = useCallback((row: TRow) => handleReorder(rows.findIndex((r) => r.id === row.id), rows.findIndex((r) => r.id === row.id) - 1), [rows, handleReorder]);
  const handleMoveDown = useCallback((row: TRow) => handleReorder(rows.findIndex((r) => r.id === row.id), rows.findIndex((r) => r.id === row.id) + 1), [rows, handleReorder]);

  const list = (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <DraggableDroppableRow key={row.id} id={row.id} disabled={dragDisabled}>
          {({ dragHandleProps, isDragging }) => (
            <TemplateCategoryItemRow
              adapter={adapter}
              row={row}
              position={index}
              total={rows.length}
              disabled={disabled}
              locked={locked}
              onOpenInspector={onOpenInspector}
              onDelete={onDelete}
              onInlineChange={onInlineChange}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              dragHandleProps={dragHandleProps}
              isDragging={isDragging}
              saving={pendingRowId === row.id}
              error={rowErrors?.[row.id]}
            />
          )}
        </DraggableDroppableRow>
      ))}
    </div>
  );

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {adapter.supportsReorder && !dragDisabled ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {list}
        </DndContext>
      ) : (
        list
      )}
    </>
  );
}
