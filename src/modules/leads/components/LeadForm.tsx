"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { leadFormSchema, type LeadFormInput } from "@/modules/leads/schema";
import { LEAD_SOURCES, EVENT_TYPES } from "@/modules/leads/constants";
import type { DataResult } from "@/lib/data/result";
import type { Lead } from "@/types/lead";

interface LeadFormProps {
  defaultValues?: Partial<LeadFormInput>;
  onSubmit: (input: LeadFormInput) => Promise<DataResult<Lead>>;
  submitLabel: string;
  cancelHref: string;
}

const emptyDefaults: LeadFormInput = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  instagram: "",
  source: "",
  event_type: "",
  event_date: "",
  location: "",
  budget_min: "",
  budget_max: "",
  message: "",
  assigned_to: "",
};

export function LeadForm({
  defaultValues,
  onSubmit,
  submitLabel,
  cancelHref,
}: LeadFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<LeadFormInput>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });

  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

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
          setError(field as keyof LeadFormInput, { message });
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="First name" htmlFor="first_name" required error={errors.first_name?.message}>
          <Input id="first_name" invalid={!!errors.first_name} {...register("first_name")} />
        </FormField>
        <FormField label="Last name" htmlFor="last_name" required error={errors.last_name?.message}>
          <Input id="last_name" invalid={!!errors.last_name} {...register("last_name")} />
        </FormField>
        <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
          <Input id="email" type="email" invalid={!!errors.email} {...register("email")} />
        </FormField>
        <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" invalid={!!errors.phone} {...register("phone")} />
        </FormField>
        <FormField label="Instagram" htmlFor="instagram" error={errors.instagram?.message}>
          <Input id="instagram" placeholder="@handle" invalid={!!errors.instagram} {...register("instagram")} />
        </FormField>
        <FormField label="Source" htmlFor="source" required error={errors.source?.message}>
          <Select id="source" invalid={!!errors.source} {...register("source")}>
            <option value="">Select a source</option>
            {LEAD_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Event type" htmlFor="event_type" error={errors.event_type?.message}>
          <Select id="event_type" invalid={!!errors.event_type} {...register("event_type")}>
            <option value="">Not specified</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Event date" htmlFor="event_date" error={errors.event_date?.message}>
          <Input id="event_date" type="date" invalid={!!errors.event_date} {...register("event_date")} />
        </FormField>
        <FormField label="Location" htmlFor="location" error={errors.location?.message}>
          <Input id="location" invalid={!!errors.location} {...register("location")} />
        </FormField>
        <FormField label="Assigned to" htmlFor="assigned_to" error={errors.assigned_to?.message}>
          <Input id="assigned_to" placeholder="Team member name" invalid={!!errors.assigned_to} {...register("assigned_to")} />
        </FormField>
        <FormField label="Budget min (USD)" htmlFor="budget_min" error={errors.budget_min?.message}>
          <Input id="budget_min" type="number" min={0} invalid={!!errors.budget_min} {...register("budget_min")} />
        </FormField>
        <FormField label="Budget max (USD)" htmlFor="budget_max" error={errors.budget_max?.message}>
          <Input id="budget_max" type="number" min={0} invalid={!!errors.budget_max} {...register("budget_max")} />
        </FormField>
      </div>

      <FormField label="Message" htmlFor="message" error={errors.message?.message}>
        <Textarea id="message" rows={4} invalid={!!errors.message} {...register("message")} />
      </FormField>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
