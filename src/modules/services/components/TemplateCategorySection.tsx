"use client";

import { useEffect, useState } from "react";
import { TemplateCategoryHeader } from "@/modules/services/components/TemplateCategoryHeader";
import { TemplateCategorySummary } from "@/modules/services/components/TemplateCategorySummary";
import { TemplateCategoryToolbar } from "@/modules/services/components/TemplateCategoryToolbar";
import { TemplateCategoryList } from "@/modules/services/components/TemplateCategoryList";
import { TemplateInspectorDrawer } from "@/modules/services/components/TemplateInspectorDrawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { classifyThrownError } from "@/modules/services/hooks/errorContract";
import { buildFormValues, buildInput, fromFieldFormValue } from "@/modules/services/templateFieldValues";
import type { TemplateCategoryAdapter } from "@/modules/services/templateCategoryAdapters";
import type { TemplateCategoryData } from "@/lib/queries/services/types";

interface TemplateCategorySectionProps<TRow extends { id: string; display_order?: number }, TInput extends Record<string, unknown>> {
  adapter: TemplateCategoryAdapter<TRow, TInput>;
  category: TemplateCategoryData<TRow>;
  serviceId: string;
  serviceVersionId: string;
  disabled: boolean;
  locked: boolean;
  disabledReason?: string;
}

interface InspectorState<TRow> {
  open: boolean;
  row: TRow | null;
}

/**
 * One category, fully composed: header, summary, toolbar, list, Inspector.
 * This is the ONLY place a category's 4 mutation hooks are called (once
 * each, per Rules of Hooks — never inside the row `.map()`), so every
 * row-level action (delete, inline autosave, reorder, Inspector Save) is
 * just a plain callback into the mutate functions already sitting here.
 */
export function TemplateCategorySection<TRow extends { id: string; display_order?: number }, TInput extends Record<string, unknown>>({
  adapter,
  category,
  serviceId,
  serviceVersionId,
  disabled,
  locked,
  disabledReason,
}: TemplateCategorySectionProps<TRow, TInput>) {
  const readOnly = disabled || locked;
  const [expanded, setExpanded] = useState(category.expectation === "expected" || category.count > 0);
  const [inspector, setInspector] = useState<InspectorState<TRow>>({ open: false, row: null });
  const [pendingRowId, setPendingRowId] = useState<string | undefined>();
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [optimisticRows, setOptimisticRows] = useState<TRow[] | null>(null);

  // Resets whenever a real refetch delivers a new `category.rows` reference
  // (after any mutation's invalidation resolves) — the optimistic override
  // only ever needs to last from the moment a drag/move completes until the
  // server-confirmed order actually lands.
  useEffect(() => {
    setOptimisticRows(null);
  }, [category.rows]);

  const createMutation = adapter.mutations.useCreate(serviceId, serviceVersionId);
  const updateMutation = adapter.mutations.useUpdate(serviceId, serviceVersionId);
  const removeMutation = adapter.mutations.useRemove(serviceId, serviceVersionId);
  const reorderMutation = adapter.mutations.useReorder(serviceId, serviceVersionId);

  const displayRows = optimisticRows ?? category.rows;

  function currentInputFor(row: TRow): TInput {
    return buildInput<TInput>(adapter.fields, buildFormValues(adapter.fields, row as unknown as Record<string, unknown>));
  }

  async function handleInspectorSave(input: TInput) {
    if (inspector.row) {
      const withOrder = adapter.supportsReorder ? { ...input, display_order: inspector.row.display_order } : input;
      await updateMutation.mutateAsync({ id: inspector.row.id, input: withOrder as TInput });
    } else {
      const withOrder = adapter.supportsReorder ? { ...input, display_order: displayRows.length } : input;
      await createMutation.mutateAsync(withOrder as TInput);
    }
  }

  async function handleDelete(row: TRow) {
    setPendingRowId(row.id);
    setRowErrors((current) => {
      const next = { ...current };
      delete next[row.id];
      return next;
    });
    try {
      await removeMutation.mutateAsync(row.id);
    } catch (error) {
      setRowErrors((current) => ({ ...current, [row.id]: classifyThrownError(error).message }));
    } finally {
      setPendingRowId(undefined);
    }
  }

  async function handleInlineChange(row: TRow, value: string | boolean) {
    if (!adapter.inlineFieldName) return;
    const field = adapter.fields.find((candidate) => candidate.name === adapter.inlineFieldName);
    if (!field) return;
    const input = { ...currentInputFor(row), [field.name]: fromFieldFormValue(field, value), display_order: row.display_order } as TInput;
    setPendingRowId(row.id);
    try {
      await updateMutation.mutateAsync({ id: row.id, input });
    } catch (error) {
      setRowErrors((current) => ({ ...current, [row.id]: classifyThrownError(error).message }));
    } finally {
      setPendingRowId(undefined);
    }
  }

  async function handleReorder(orderedRows: TRow[]) {
    setOptimisticRows(orderedRows);
    try {
      await reorderMutation.mutateAsync(orderedRows);
    } catch {
      setOptimisticRows(null);
    }
  }

  return (
    <div className="space-y-2">
      <TemplateCategoryHeader
        label={adapter.label}
        expectation={category.expectation}
        count={category.count}
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
        requirementVariant={adapter.requirementVariant}
      />

      {expanded ? (
        <div className="space-y-3 pl-1">
          <div className="flex items-center justify-between gap-3">
            <TemplateCategorySummary expectation={category.expectation} count={category.count} />
            <TemplateCategoryToolbar itemNoun={adapter.itemNoun} disabled={readOnly} disabledReason={disabledReason} onAdd={() => setInspector({ open: true, row: null })} />
          </div>

          {displayRows.length === 0 ? (
            <EmptyState title={`No ${adapter.label.toLowerCase()} yet`} description={readOnly ? undefined : `Add the first ${adapter.itemNoun} to get started.`} />
          ) : (
            <TemplateCategoryList
              adapter={adapter}
              rows={displayRows}
              disabled={disabled}
              locked={locked}
              onOpenInspector={(row) => setInspector({ open: true, row })}
              onDelete={handleDelete}
              onInlineChange={handleInlineChange}
              onReorder={handleReorder}
              pendingRowId={pendingRowId}
              rowErrors={rowErrors}
            />
          )}
        </div>
      ) : null}

      <TemplateInspectorDrawer
        adapter={adapter}
        open={inspector.open}
        row={inspector.row}
        onClose={() => setInspector({ open: false, row: null })}
        onSave={handleInspectorSave}
        readOnly={readOnly}
        readOnlyReason={disabledReason}
      />
    </div>
  );
}
