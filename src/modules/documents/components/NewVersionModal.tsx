"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/forms/FormField";
import { createDocumentVersion } from "@/lib/data";
import { DOCUMENT_VISIBILITIES, DOCUMENT_VISIBILITY_LABELS } from "@/core/enums/documentVisibility";
import { newDocumentVersionFormSchema, newDocumentVersionFormToInput, type NewDocumentVersionFormInput } from "@/modules/documents/schema";
import type { Document } from "@/types/document";

interface NewVersionModalProps {
  open: boolean;
  onClose: () => void;
  document: Document;
  onCreated: (document: Document) => void;
}

const AUTHORITATIVE_TO_FORM_FIELD: Partial<Record<string, string>> = {
  file_name: "original_file_name",
  size_bytes: "size_mb",
};

const emptyDefaults: NewDocumentVersionFormInput = {
  original_file_name: "",
  mime_type: "",
  size_mb: "",
  title: "",
  visibility: "",
  expires_at: "",
};

export function NewVersionModal({ open, onClose, document: doc, onCreated }: NewVersionModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewDocumentVersionFormInput>({
    resolver: zodResolver(newDocumentVersionFormSchema),
    defaultValues: emptyDefaults,
  });

  const handleClose = () => {
    reset(emptyDefaults);
    setFormError(null);
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await createDocumentVersion(newDocumentVersionFormToInput(doc.id, values));
    if (!result.success) {
      setFormError(result.error);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          const formField = AUTHORITATIVE_TO_FORM_FIELD[field] ?? field;
          setError(formField as keyof NewDocumentVersionFormInput, { message });
        }
      }
      return;
    }
    reset(emptyDefaults);
    onCreated(result.data);
    onClose();
  });

  return (
    <Modal open={open} onClose={handleClose} title="Add New Version">
      <p className="text-sm text-text-muted">
        Uploads version {doc.version + 1} — the current latest version will be marked superseded. Category, owner,
        and Workspace carry over automatically. No real file is uploaded.
      </p>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        {formError ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {formError}
          </div>
        ) : null}
        <FormField label="Original file name" htmlFor="version_file_name" required error={errors.original_file_name?.message}>
          <Input id="version_file_name" invalid={!!errors.original_file_name} {...register("original_file_name")} />
        </FormField>
        <FormField label="MIME type" htmlFor="version_mime_type" required error={errors.mime_type?.message}>
          <Input id="version_mime_type" invalid={!!errors.mime_type} {...register("mime_type")} />
        </FormField>
        <FormField label="Size (MB)" htmlFor="version_size_mb" required error={errors.size_mb?.message}>
          <Input id="version_size_mb" type="number" min={0} step="0.01" invalid={!!errors.size_mb} {...register("size_mb")} />
        </FormField>
        <FormField label="Title" htmlFor="version_title" hint="Optional — keeps the current title when left blank" error={errors.title?.message}>
          <Input id="version_title" invalid={!!errors.title} {...register("title")} />
        </FormField>
        <FormField label="Visibility" htmlFor="version_visibility" hint="Optional — keeps the current visibility when left blank" error={errors.visibility?.message}>
          <Select id="version_visibility" invalid={!!errors.visibility} {...register("visibility")}>
            <option value="">Keep current</option>
            {DOCUMENT_VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {DOCUMENT_VISIBILITY_LABELS[v]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Expiration date" htmlFor="version_expires_at" hint="Optional" error={errors.expires_at?.message}>
          <Input id="version_expires_at" type="date" invalid={!!errors.expires_at} {...register("expires_at")} />
        </FormField>
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Uploading…" : "Add Version"}
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
