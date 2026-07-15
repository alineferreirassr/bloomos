"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import {
  contractExhibitFormSchema,
  exhibitFormToInput,
  type ContractExhibitFormInput,
} from "@/modules/contracts/schema";
import { createContractExhibit, updateContractExhibit } from "@/lib/data";
import type { ContractExhibit } from "@/types/contractExhibit";

interface ExhibitFormProps {
  contractId: string;
  /** null creates a new exhibit; a ContractExhibit edits it in place. */
  exhibit: ContractExhibit | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const emptyDefaults: ContractExhibitFormInput = { title: "", description: "" };

function exhibitToFormValues(exhibit: ContractExhibit): ContractExhibitFormInput {
  return { title: exhibit.title, description: exhibit.description ?? "" };
}

export function ExhibitForm({ contractId, exhibit, open, onClose, onSaved }: ExhibitFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContractExhibitFormInput>({
    resolver: zodResolver(contractExhibitFormSchema),
    defaultValues: exhibit ? exhibitToFormValues(exhibit) : emptyDefaults,
  });

  const handleClose = () => {
    setFormError(null);
    reset(exhibit ? exhibitToFormValues(exhibit) : emptyDefaults);
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const input = exhibitFormToInput(values);
    const result = exhibit
      ? await updateContractExhibit(exhibit.id, input)
      : await createContractExhibit(contractId, input);
    if (!result.success) {
      setFormError(result.error);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof ContractExhibitFormInput, { message });
        }
      }
      return;
    }
    onSaved();
  });

  return (
    <Modal open={open} onClose={handleClose} title={exhibit ? "Edit Exhibit" : "Add Exhibit"}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {formError}
          </div>
        ) : null}

        <FormField label="Title" htmlFor="exhibit_title" required error={errors.title?.message}>
          <Input id="exhibit_title" placeholder="e.g. Payment Schedule" invalid={!!errors.title} {...register("title")} />
        </FormField>

        <FormField label="Description" htmlFor="exhibit_description" error={errors.description?.message}>
          <Textarea id="exhibit_description" rows={3} invalid={!!errors.description} {...register("description")} />
        </FormField>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : exhibit ? "Save changes" : "Add exhibit"}
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
