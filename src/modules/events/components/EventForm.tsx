"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { getClients } from "@/lib/data";
import type { Client } from "@/types/client";
import { eventFormSchema, type EventFormInput } from "@/modules/events/schema";
import { EVENT_TYPE_LABELS, EVENT_TYPES } from "@/core/enums/eventType";
import { EVENT_PRIORITY_LABELS, EVENT_PRIORITIES } from "@/core/enums/eventPriority";
import type { DataResult } from "@/lib/data/result";
import type { Event } from "@/types/event";

interface EventFormProps {
  defaultValues?: Partial<EventFormInput>;
  onSubmit: (input: EventFormInput) => Promise<DataResult<Event>>;
  submitLabel: string;
  cancelHref: string;
}

const emptyDefaults: EventFormInput = {
  client_id: "",
  originating_lead_id: "",
  title: "",
  event_type: "other",
  event_date: "",
  start_time: "",
  end_time: "",
  timezone: "",
  location_name: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  latitude: "",
  longitude: "",
  guest_count: "",
  budget_min: "",
  budget_max: "",
  package_name: "",
  theme: "",
  color_palette: "",
  surprise_event: false,
  confidentiality_notes: "",
  accessibility_notes: "",
  dietary_notes: "",
  weather_plan: "",
  backup_location: "",
  internal_summary: "",
  assigned_owner: "",
  priority: "normal",
};

export function EventForm({ defaultValues, onSubmit, submitLabel, cancelHref }: EventFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[] | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EventFormInput>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });

  useEffect(() => {
    let cancelled = false;
    getClients().then((result) => {
      if (!cancelled) setClients(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The Client <select> has no matching <option> until getClients() resolves
  // and React re-renders with them, so the browser can't select
  // defaultValues.client_id on first render and silently falls back to the
  // empty placeholder. Calling setValue() in the same tick as setClients()
  // (above) is too early — the new <option> elements don't exist in the DOM
  // yet. Waiting for `clients` to actually change and re-applying here, once
  // React has committed the new options, fixes editing an existing Event
  // (where the Client would otherwise appear unselected despite being saved
  // correctly) without affecting the blank New Event form.
  useEffect(() => {
    if (clients && defaultValues?.client_id) {
      setValue("client_id", defaultValues.client_id, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

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
    try {
      const result = await onSubmit(values);
      if (!result.success) {
        setFormError(result.error);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            setError(field as keyof EventFormInput, { message });
          }
        }
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save this event. Please try again.");
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {formError ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {formError}
        </div>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold text-text">Event basics</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Client" htmlFor="client_id" required error={errors.client_id?.message}>
            <Select id="client_id" invalid={!!errors.client_id} disabled={!clients} {...register("client_id")}>
              <option value="">{clients ? "Select a client" : "Loading clients…"}</option>
              {clients?.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.first_name} {client.last_name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Title" htmlFor="title" required error={errors.title?.message}>
            <Input id="title" invalid={!!errors.title} {...register("title")} />
          </FormField>
          <FormField label="Event type" htmlFor="event_type" required error={errors.event_type?.message}>
            <Select id="event_type" invalid={!!errors.event_type} {...register("event_type")}>
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EVENT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Priority" htmlFor="priority" required error={errors.priority?.message}>
            <Select id="priority" invalid={!!errors.priority} {...register("priority")}>
              {EVENT_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {EVENT_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm text-text">
            <Checkbox
              {...register("surprise_event")}
            />
            Surprise event
          </label>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Date &amp; time</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Event date" htmlFor="event_date" error={errors.event_date?.message}>
            <Input id="event_date" type="date" invalid={!!errors.event_date} {...register("event_date")} />
          </FormField>
          <FormField label="Timezone" htmlFor="timezone" hint="e.g. America/Los_Angeles" error={errors.timezone?.message}>
            <Input id="timezone" invalid={!!errors.timezone} {...register("timezone")} />
          </FormField>
          <FormField label="Start time" htmlFor="start_time" error={errors.start_time?.message}>
            <Input id="start_time" type="time" invalid={!!errors.start_time} {...register("start_time")} />
          </FormField>
          <FormField label="End time" htmlFor="end_time" error={errors.end_time?.message}>
            <Input id="end_time" type="time" invalid={!!errors.end_time} {...register("end_time")} />
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Location</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Location name" htmlFor="location_name" error={errors.location_name?.message}>
            <Input id="location_name" invalid={!!errors.location_name} {...register("location_name")} />
          </FormField>
          <FormField label="Address" htmlFor="address" error={errors.address?.message}>
            <Input id="address" invalid={!!errors.address} {...register("address")} />
          </FormField>
          <FormField label="City" htmlFor="city" error={errors.city?.message}>
            <Input id="city" invalid={!!errors.city} {...register("city")} />
          </FormField>
          <FormField label="State" htmlFor="state" error={errors.state?.message}>
            <Input id="state" invalid={!!errors.state} {...register("state")} />
          </FormField>
          <FormField label="ZIP code" htmlFor="zip_code" error={errors.zip_code?.message}>
            <Input id="zip_code" invalid={!!errors.zip_code} {...register("zip_code")} />
          </FormField>
          <FormField label="Backup location" htmlFor="backup_location" error={errors.backup_location?.message}>
            <Input id="backup_location" invalid={!!errors.backup_location} {...register("backup_location")} />
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Details</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Guest count" htmlFor="guest_count" error={errors.guest_count?.message}>
            <Input id="guest_count" type="number" min={0} invalid={!!errors.guest_count} {...register("guest_count")} />
          </FormField>
          <FormField label="Package name" htmlFor="package_name" error={errors.package_name?.message}>
            <Input id="package_name" invalid={!!errors.package_name} {...register("package_name")} />
          </FormField>
          <FormField label="Budget min (USD)" htmlFor="budget_min" error={errors.budget_min?.message}>
            <Input id="budget_min" type="number" min={0} invalid={!!errors.budget_min} {...register("budget_min")} />
          </FormField>
          <FormField label="Budget max (USD)" htmlFor="budget_max" error={errors.budget_max?.message}>
            <Input id="budget_max" type="number" min={0} invalid={!!errors.budget_max} {...register("budget_max")} />
          </FormField>
          <FormField label="Theme" htmlFor="theme" error={errors.theme?.message}>
            <Input id="theme" invalid={!!errors.theme} {...register("theme")} />
          </FormField>
          <FormField label="Color palette" htmlFor="color_palette" error={errors.color_palette?.message}>
            <Input id="color_palette" invalid={!!errors.color_palette} {...register("color_palette")} />
          </FormField>
          <FormField label="Assigned owner" htmlFor="assigned_owner" error={errors.assigned_owner?.message}>
            <Input id="assigned_owner" placeholder="Team member name" invalid={!!errors.assigned_owner} {...register("assigned_owner")} />
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Notes</h3>
        <p className="mt-1 text-xs text-text-muted">Internal only.</p>
        <div className="mt-3 space-y-4">
          <FormField label="Confidentiality notes" htmlFor="confidentiality_notes" error={errors.confidentiality_notes?.message}>
            <Textarea id="confidentiality_notes" rows={2} invalid={!!errors.confidentiality_notes} {...register("confidentiality_notes")} />
          </FormField>
          <FormField label="Accessibility notes" htmlFor="accessibility_notes" error={errors.accessibility_notes?.message}>
            <Textarea id="accessibility_notes" rows={2} invalid={!!errors.accessibility_notes} {...register("accessibility_notes")} />
          </FormField>
          <FormField label="Dietary notes" htmlFor="dietary_notes" error={errors.dietary_notes?.message}>
            <Textarea id="dietary_notes" rows={2} invalid={!!errors.dietary_notes} {...register("dietary_notes")} />
          </FormField>
          <FormField label="Weather plan" htmlFor="weather_plan" error={errors.weather_plan?.message}>
            <Textarea id="weather_plan" rows={2} invalid={!!errors.weather_plan} {...register("weather_plan")} />
          </FormField>
          <FormField label="Internal summary" htmlFor="internal_summary" error={errors.internal_summary?.message}>
            <Textarea id="internal_summary" rows={3} invalid={!!errors.internal_summary} {...register("internal_summary")} />
          </FormField>
        </div>
      </section>

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
