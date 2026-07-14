"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  checklistFormToInput,
  checklistItemFormSchema,
  type ChecklistItemFormInput,
} from "@/modules/checklist/schema";
import { CHECKLIST_CATEGORIES, CHECKLIST_CATEGORY_LABELS } from "@/core/enums/checklistCategory";
import { NOTE_PRIORITIES, NOTE_PRIORITY_LABELS } from "@/core/enums/notePriority";
import { ASSIGNED_TYPES, ASSIGNED_TYPE_LABELS } from "@/core/enums/assignedType";
import { CHECKLIST_STATUSES, CHECKLIST_STATUS_LABELS, type ChecklistStatus } from "@/core/enums/checklistStatus";
import { completeChecklistItem, createChecklistItem, updateChecklistItem, updateChecklistItemStatus } from "@/lib/data";
import type { ChecklistItem } from "@/types/checklistItem";

interface ChecklistItemFormProps {
  eventId: string;
  /** null creates a new item; a ChecklistItem edits it in place. */
  item: ChecklistItem | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const emptyDefaults: ChecklistItemFormInput = {
  title: "",
  description: "",
  category: "planning",
  priority: "normal",
  due_date: "",
  assigned_type: "unknown",
  assigned_name: "",
};

function itemToFormValues(item: ChecklistItem): ChecklistItemFormInput {
  return {
    title: item.title,
    description: item.description ?? "",
    category: item.category,
    priority: item.priority,
    due_date: item.due_date ?? "",
    assigned_type: item.assigned_type,
    assigned_name: item.assigned_name ?? "",
  };
}

/**
 * Status is deliberately not part of checklistItemFormSchema/checklistItemSchema
 * (see modules/checklist/schema.ts) — updateChecklistItem never touches it,
 * so a completed item's completed_at can only be set through the dedicated
 * completeChecklistItem/updateChecklistItemStatus functions, which also carry
 * the centralized timeline recording. This form shows a Status field only
 * when editing (a new item always starts "pending" — the data layer enforces
 * that), and submits any status change through those functions separately
 * from the schema-bound field update.
 */
export function ChecklistItemForm({ eventId, item, open, onClose, onSaved }: ChecklistItemFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<ChecklistStatus>(item?.status ?? "pending");
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChecklistItemFormInput>({
    resolver: zodResolver(checklistItemFormSchema),
    defaultValues: item ? itemToFormValues(item) : emptyDefaults,
  });

  const handleClose = () => {
    setFormError(null);
    reset(item ? itemToFormValues(item) : emptyDefaults);
    setStatus(item?.status ?? "pending");
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const input = checklistFormToInput(values);

    const result = item ? await updateChecklistItem(item.id, input) : await createChecklistItem(eventId, input);
    if (!result.success) {
      setFormError(result.error);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof ChecklistItemFormInput, { message });
        }
      }
      return;
    }

    if (item && status !== item.status) {
      const statusResult =
        status === "completed" ? await completeChecklistItem(item.id) : await updateChecklistItemStatus(item.id, status);
      if (!statusResult.success) {
        setFormError(statusResult.error);
        return;
      }
    }

    onSaved();
  });

  return (
    <Modal open={open} onClose={handleClose} title={item ? "Edit Checklist Item" : "Add Checklist Item"}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {formError}
          </div>
        ) : null}

        <FormField label="Title" htmlFor="checklist_title" required error={errors.title?.message}>
          <Input id="checklist_title" invalid={!!errors.title} {...register("title")} />
        </FormField>

        <FormField label="Description" htmlFor="checklist_description" error={errors.description?.message}>
          <Textarea id="checklist_description" rows={3} invalid={!!errors.description} {...register("description")} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Category" htmlFor="checklist_category" error={errors.category?.message}>
            <Select id="checklist_category" invalid={!!errors.category} {...register("category")}>
              {CHECKLIST_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CHECKLIST_CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Priority" htmlFor="checklist_priority" error={errors.priority?.message}>
            <Select id="checklist_priority" invalid={!!errors.priority} {...register("priority")}>
              {NOTE_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {NOTE_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {item ? (
          <FormField label="Status" htmlFor="checklist_status">
            <Select
              id="checklist_status"
              value={status}
              onChange={(event) => setStatus(event.target.value as ChecklistStatus)}
            >
              {CHECKLIST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CHECKLIST_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}

        <FormField label="Due date" htmlFor="checklist_due_date" error={errors.due_date?.message}>
          <Input id="checklist_due_date" type="date" invalid={!!errors.due_date} {...register("due_date")} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Assigned type" htmlFor="checklist_assigned_type" error={errors.assigned_type?.message}>
            <Select id="checklist_assigned_type" invalid={!!errors.assigned_type} {...register("assigned_type")}>
              {ASSIGNED_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ASSIGNED_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Assigned name"
            htmlFor="checklist_assigned_name"
            hint="Free text for now"
            error={errors.assigned_name?.message}
          >
            <Input id="checklist_assigned_name" invalid={!!errors.assigned_name} {...register("assigned_name")} />
          </FormField>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : item ? "Save changes" : "Add item"}
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
