"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { noteFormSchema, type NoteFormInput } from "@/modules/notes/schema";
import { NOTE_CATEGORIES, NOTE_CATEGORY_LABELS } from "@/core/enums/noteCategory";
import { NOTE_PRIORITIES, NOTE_PRIORITY_LABELS } from "@/core/enums/notePriority";
import type { DataResult } from "@/lib/data/result";
import type { Note } from "@/types/note";

interface NoteFormProps {
  onSubmit: (input: NoteFormInput) => Promise<DataResult<Note>>;
  onSuccess: () => void;
  onCancel: () => void;
}

export function NoteForm({ onSubmit, onSuccess, onCancel }: NoteFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NoteFormInput>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: { title: "", content: "", category: "general", priority: "normal" },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await onSubmit(values);
    if (!result.success) {
      setFormError(result.error);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof NoteFormInput, { message });
        }
      }
      return;
    }
    onSuccess();
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {formError}
        </div>
      ) : null}
      <FormField label="Title" htmlFor="note_title" required error={errors.title?.message}>
        <Input id="note_title" invalid={!!errors.title} {...register("title")} />
      </FormField>
      <FormField label="Content" htmlFor="note_content" required error={errors.content?.message}>
        <Textarea id="note_content" rows={3} invalid={!!errors.content} {...register("content")} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Category" htmlFor="note_category" error={errors.category?.message}>
          <Select id="note_category" invalid={!!errors.category} {...register("category")}>
            {NOTE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {NOTE_CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Priority" htmlFor="note_priority" error={errors.priority?.message}>
          <Select id="note_priority" invalid={!!errors.priority} {...register("priority")}>
            {NOTE_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {NOTE_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Add note"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
