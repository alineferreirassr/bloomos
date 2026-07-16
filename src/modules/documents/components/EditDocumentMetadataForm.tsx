"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS } from "@/core/enums/documentCategory";
import {
  documentEditMetadataFormSchema,
  type DocumentEditMetadataFormInput,
} from "@/modules/documents/schema";
import type { Document } from "@/types/document";
import type { DataResult } from "@/lib/data/result";

interface EditDocumentMetadataFormProps {
  defaultValues: DocumentEditMetadataFormInput;
  cancelHref: string;
  onSubmit: (input: DocumentEditMetadataFormInput) => Promise<DataResult<Document>>;
}

export function EditDocumentMetadataForm({ defaultValues, cancelHref, onSubmit }: EditDocumentMetadataFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DocumentEditMetadataFormInput>({
    resolver: zodResolver(documentEditMetadataFormSchema),
    defaultValues,
  });

  const handleCancel = () => {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return;
    router.push(cancelHref);
  };

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await onSubmit(values);
    if (!result.success) {
      setFormError(result.error);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof DocumentEditMetadataFormInput, { message });
        }
      }
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {formError ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {formError}
        </div>
      ) : null}

      <p className="text-xs text-text-muted">
        Only title, description, category, and expiration are editable here — file content, folder, status, and
        visibility each have their own dedicated action on the detail page.
      </p>

      <FormField label="Title" htmlFor="edit_title" hint="Leave blank to keep the current title" error={errors.title?.message}>
        <Input id="edit_title" invalid={!!errors.title} {...register("title")} />
      </FormField>

      <FormField label="Description" htmlFor="edit_description" error={errors.description?.message}>
        <Textarea id="edit_description" rows={3} invalid={!!errors.description} {...register("description")} />
      </FormField>

      <FormField label="Category" htmlFor="edit_category" required error={errors.category?.message}>
        <Select id="edit_category" invalid={!!errors.category} {...register("category")}>
          {DOCUMENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {DOCUMENT_CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Expiration date" htmlFor="edit_expires_at" hint="Optional" error={errors.expires_at?.message}>
        <Input id="edit_expires_at" type="date" invalid={!!errors.expires_at} {...register("expires_at")} />
      </FormField>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
