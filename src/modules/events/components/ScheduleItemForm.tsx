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
  scheduleFormToInput,
  scheduleItemFormSchema,
  type ScheduleItemFormInput,
} from "@/modules/events/schema";
import { SCHEDULE_CATEGORIES, SCHEDULE_CATEGORY_LABELS } from "@/core/enums/scheduleCategory";
import { SCHEDULE_STATUSES, SCHEDULE_STATUS_LABELS, type ScheduleStatus } from "@/core/enums/scheduleStatus";
import { createScheduleItem, updateScheduleItem, updateScheduleItemStatus } from "@/lib/data";
import type { EventScheduleItem } from "@/types/eventScheduleItem";

interface ScheduleItemFormProps {
  eventId: string;
  /** null creates a new item; an EventScheduleItem edits it in place. */
  item: EventScheduleItem | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const emptyDefaults: ScheduleItemFormInput = {
  title: "",
  description: "",
  start_time: "",
  end_time: "",
  location: "",
  assigned_to: "",
  category: "setup",
};

function itemToFormValues(item: EventScheduleItem): ScheduleItemFormInput {
  return {
    title: item.title,
    description: item.description ?? "",
    start_time: item.start_time ?? "",
    end_time: item.end_time ?? "",
    location: item.location ?? "",
    assigned_to: item.assigned_to ?? "",
    category: item.category,
  };
}

/**
 * Status is deliberately not part of scheduleItemFormSchema/scheduleItemSchema
 * (see modules/events/schema.ts) — it's changed only through the dedicated
 * updateScheduleItemStatus function, which carries its own centralized
 * timeline entry ("Schedule item status changed to ..."). This form shows a
 * Status field only when editing (a new item always starts "planned" — the
 * data layer enforces that), and submits any status change through that
 * function separately from the schema-bound field update.
 */
export function ScheduleItemForm({ eventId, item, open, onClose, onSaved }: ScheduleItemFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<ScheduleStatus>(item?.status ?? "planned");
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleItemFormInput>({
    resolver: zodResolver(scheduleItemFormSchema),
    defaultValues: item ? itemToFormValues(item) : emptyDefaults,
  });

  const handleClose = () => {
    setFormError(null);
    reset(item ? itemToFormValues(item) : emptyDefaults);
    setStatus(item?.status ?? "planned");
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const input = scheduleFormToInput(values);

    try {
      const result = item ? await updateScheduleItem(item.id, input) : await createScheduleItem(eventId, input);
      if (!result.success) {
        setFormError(result.error);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            setError(field as keyof ScheduleItemFormInput, { message });
          }
        }
        return;
      }

      if (item && status !== item.status) {
        const statusResult = await updateScheduleItemStatus(item.id, status);
        if (!statusResult.success) {
          setFormError(statusResult.error);
          return;
        }
      }

      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save this schedule item. Please try again.");
    }
  });

  return (
    <Modal open={open} onClose={handleClose} title={item ? "Edit Schedule Item" : "Add Schedule Item"}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {formError}
          </div>
        ) : null}

        <FormField label="Title" htmlFor="schedule_title" required error={errors.title?.message}>
          <Input id="schedule_title" invalid={!!errors.title} {...register("title")} />
        </FormField>

        <FormField label="Description" htmlFor="schedule_description" error={errors.description?.message}>
          <Textarea id="schedule_description" rows={3} invalid={!!errors.description} {...register("description")} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Start time"
            htmlFor="schedule_start_time"
            hint="In the event's timezone"
            error={errors.start_time?.message}
          >
            <Input id="schedule_start_time" type="time" invalid={!!errors.start_time} {...register("start_time")} />
          </FormField>
          <FormField label="End time" htmlFor="schedule_end_time" error={errors.end_time?.message}>
            <Input id="schedule_end_time" type="time" invalid={!!errors.end_time} {...register("end_time")} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Category" htmlFor="schedule_category" error={errors.category?.message}>
            <Select id="schedule_category" invalid={!!errors.category} {...register("category")}>
              {SCHEDULE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {SCHEDULE_CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </FormField>
          {item ? (
            <FormField label="Status" htmlFor="schedule_status">
              <Select
                id="schedule_status"
                value={status}
                onChange={(event) => setStatus(event.target.value as ScheduleStatus)}
              >
                {SCHEDULE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {SCHEDULE_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
        </div>

        <FormField label="Location" htmlFor="schedule_location" error={errors.location?.message}>
          <Input id="schedule_location" invalid={!!errors.location} {...register("location")} />
        </FormField>

        <FormField
          label="Assigned to"
          htmlFor="schedule_assigned_to"
          hint="Free text for now"
          error={errors.assigned_to?.message}
        >
          <Input id="schedule_assigned_to" invalid={!!errors.assigned_to} {...register("assigned_to")} />
        </FormField>

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
