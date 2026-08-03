"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/forms/FormField";
import { DOCUMENT_VISIBILITIES, DOCUMENT_VISIBILITY_LABELS } from "@/core/enums/documentVisibility";
import { documentFolderFormSchema, type DocumentFolderFormInput } from "@/modules/documents/schema";
import type { DataResult } from "@/lib/data/result";
import type { DocumentFolder } from "@/types/documentFolder";

interface FolderFormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  submitLabel: string;
  defaultValues: DocumentFolderFormInput;
  onSubmit: (input: DocumentFolderFormInput) => Promise<DataResult<DocumentFolder>>;
  onSaved: (folder: DocumentFolder) => void;
}

/** Shared name/description/visibility form for both "create subfolder" and "rename folder" — owner_type/owner_id/parent_folder_id/sort_order are always supplied by the caller's onSubmit, never user-entered here. */
export function FolderFormModal({ open, onClose, title, submitLabel, defaultValues, onSubmit, onSaved }: FolderFormModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DocumentFolderFormInput>({
    resolver: zodResolver(documentFolderFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = handleSubmit(async (values) => {
    const result = await onSubmit(values);
    if (result.success) {
      onSaved(result.data);
      onClose();
    }
  });

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormField label="Name" htmlFor="folder_name" required error={errors.name?.message}>
          <Input id="folder_name" invalid={!!errors.name} {...register("name")} />
        </FormField>
        <FormField label="Description" htmlFor="folder_description" error={errors.description?.message}>
          <Textarea id="folder_description" rows={2} invalid={!!errors.description} {...register("description")} />
        </FormField>
        <FormField label="Visibility" htmlFor="folder_visibility" required error={errors.visibility?.message}>
          <Select id="folder_visibility" invalid={!!errors.visibility} {...register("visibility")}>
            {DOCUMENT_VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {DOCUMENT_VISIBILITY_LABELS[v]}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
