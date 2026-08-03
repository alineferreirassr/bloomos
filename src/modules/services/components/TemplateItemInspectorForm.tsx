"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { classifyThrownError } from "@/modules/services/hooks/errorContract";
import { buildFormValues, buildInput, type TemplateFieldFormValues } from "@/modules/services/templateFieldValues";
import type { TemplateCategoryAdapter } from "@/modules/services/templateCategoryAdapters";

interface TemplateItemInspectorFormProps<TRow extends { id: string }, TInput extends Record<string, unknown>> {
  adapter: TemplateCategoryAdapter<TRow, TInput>;
  /** `null` when creating a new row. */
  row: TRow | null;
  onSave: (input: TInput) => Promise<unknown>;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  readOnly: boolean;
  readOnlyReason?: string;
}

/**
 * The one generic form every one of the 16 category adapters renders inside
 * the Inspector Drawer — no per-category JSX. Every field here saves
 * together through a single explicit Save (see templateCategoryAdapters.ts's
 * own doc comment for why: every category's `update` call replaces the
 * whole row, so there is no cheaper partial-field endpoint autosave could
 * safely target — the one real autosave path in this checkpoint is
 * reordering and each category's single approved inline field, both handled
 * outside this form entirely).
 */
export function TemplateItemInspectorForm<TRow extends { id: string }, TInput extends Record<string, unknown>>({
  adapter,
  row,
  onSave,
  onCancel,
  onDirtyChange,
  readOnly,
  readOnlyReason,
}: TemplateItemInspectorFormProps<TRow, TInput>) {
  // A frozen snapshot from the moment this form mounted — plain `useState`
  // with a lazy initializer (never given a setter call) rather than a ref,
  // since reading `.current` during render is exactly the "accessing a ref
  // value during render" pattern React Compiler flags.
  const [initialValues] = useState<TemplateFieldFormValues>(() => buildFormValues(adapter.fields, row as Record<string, unknown> | null));
  const [values, setValues] = useState<TemplateFieldFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = adapter.fields.some((field) => values[field.name] !== initialValues[field.name]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  function setFieldValue(name: string, value: string | boolean) {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setFormError(null);
    try {
      const input = buildInput<TInput>(adapter.fields, values);
      await onSave(input);
    } catch (error) {
      const classified = classifyThrownError(error);
      setFormError(classified.message);
      if (classified.fieldErrors) {
        const mapped: Record<string, string> = {};
        for (const [field, message] of Object.entries(classified.fieldErrors)) {
          if (message) mapped[field] = message;
        }
        setFieldErrors(mapped);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex h-full flex-col gap-4">
      {readOnly && readOnlyReason ? (
        <p className="rounded-md border border-border bg-text/5 px-3 py-2 text-xs text-text-muted">{readOnlyReason}</p>
      ) : null}
      {formError ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <div className="flex-1 space-y-4 overflow-y-auto">
        {adapter.fields.map((field) => {
          const fieldId = `template-field-${adapter.key}-${field.name}`;
          const value = values[field.name];
          const error = fieldErrors[field.name];

          if (field.kind === "boolean") {
            return (
              <label key={field.name} htmlFor={fieldId} className="flex items-center gap-2 text-sm text-text">
                <Checkbox
                  id={fieldId}
                  checked={Boolean(value)}
                  disabled={readOnly}
                  onChange={(event) => setFieldValue(field.name, event.target.checked)}
                />
                {field.label}
              </label>
            );
          }

          return (
            <FormField key={field.name} label={field.label} htmlFor={fieldId} required={field.required} hint={field.hint} error={error}>
              {field.kind === "textarea" || field.kind === "list" ? (
                <Textarea
                  id={fieldId}
                  invalid={!!error}
                  disabled={readOnly}
                  value={String(value)}
                  onChange={(event) => setFieldValue(field.name, event.target.value)}
                />
              ) : field.kind === "select" ? (
                <Select id={fieldId} invalid={!!error} disabled={readOnly} value={String(value)} onChange={(event) => setFieldValue(field.name, event.target.value)}>
                  {!field.required ? <option value="">—</option> : null}
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={fieldId}
                  type={field.kind === "number" || field.kind === "money" ? "number" : "text"}
                  step={field.kind === "money" ? "0.01" : undefined}
                  invalid={!!error}
                  disabled={readOnly}
                  placeholder={field.placeholder}
                  value={String(value)}
                  onChange={(event) => setFieldValue(field.name, event.target.value)}
                />
              )}
            </FormField>
          );
        })}
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-3">
        {readOnly ? (
          <Tooltip content={readOnlyReason ?? "This can't be edited right now."}>
            <Button type="button" aria-disabled="true" onClick={(event) => event.preventDefault()} className="cursor-not-allowed opacity-45">
              Save
            </Button>
          </Tooltip>
        ) : (
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
