"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { clientFormSchema, type ClientFormInput } from "@/modules/clients/schema";
import { CLIENT_SOURCES, RELATIONSHIP_STATUS_OPTIONS } from "@/modules/clients/constants";
import type { DataResult } from "@/lib/data/result";
import type { Client } from "@/types/client";

interface ClientFormProps {
  defaultValues?: Partial<ClientFormInput>;
  onSubmit: (input: ClientFormInput) => Promise<DataResult<Client>>;
  submitLabel: string;
  cancelHref: string;
}

const emptyDefaults: ClientFormInput = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  instagram: "",
  partner_name: "",
  relationship_status: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  source: "",
  important_dates: [],
  how_they_met: "",
  first_date: "",
  relationship_anniversary: "",
  engagement_date: "",
  wedding_date: "",
  favorite_colors: "",
  favorite_flowers: "",
  favorite_music: "",
  favorite_food: "",
  favorite_drinks: "",
  favorite_restaurants: "",
  preferred_style: "",
  disliked_elements: "",
  allergies: "",
  accessibility_needs: "",
  dietary_restrictions: "",
  preferred_communication_time: "",
  do_not_call: false,
  surprise_event_confidentiality: false,
  emergency_contact_name: "",
  emergency_contact_phone: "",
};

export function ClientForm({ defaultValues, onSubmit, submitLabel, cancelHref }: ClientFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ClientFormInput>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "important_dates" });

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
          setError(field as keyof ClientFormInput, { message });
        }
      }
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
        <h3 className="text-sm font-semibold text-text">Contact information</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
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
          <FormField label="Source" htmlFor="source" error={errors.source?.message}>
            <Select id="source" invalid={!!errors.source} {...register("source")}>
              <option value="">Not specified</option>
              {CLIENT_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Address</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
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
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Relationship</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Partner name" htmlFor="partner_name" error={errors.partner_name?.message}>
            <Input id="partner_name" invalid={!!errors.partner_name} {...register("partner_name")} />
          </FormField>
          <FormField
            label="Relationship status"
            htmlFor="relationship_status"
            error={errors.relationship_status?.message}
          >
            <Select
              id="relationship_status"
              invalid={!!errors.relationship_status}
              {...register("relationship_status")}
            >
              <option value="">Not specified</option>
              {RELATIONSHIP_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="How they met" htmlFor="how_they_met" error={errors.how_they_met?.message}>
            <Input id="how_they_met" invalid={!!errors.how_they_met} {...register("how_they_met")} />
          </FormField>
          <FormField label="First date" htmlFor="first_date" error={errors.first_date?.message}>
            <Input id="first_date" type="date" invalid={!!errors.first_date} {...register("first_date")} />
          </FormField>
          <FormField
            label="Relationship anniversary"
            htmlFor="relationship_anniversary"
            error={errors.relationship_anniversary?.message}
          >
            <Input
              id="relationship_anniversary"
              type="date"
              invalid={!!errors.relationship_anniversary}
              {...register("relationship_anniversary")}
            />
          </FormField>
          <FormField label="Proposal date" htmlFor="engagement_date" error={errors.engagement_date?.message}>
            <Input
              id="engagement_date"
              type="date"
              invalid={!!errors.engagement_date}
              {...register("engagement_date")}
            />
          </FormField>
          <FormField label="Wedding date" htmlFor="wedding_date" error={errors.wedding_date?.message}>
            <Input id="wedding_date" type="date" invalid={!!errors.wedding_date} {...register("wedding_date")} />
          </FormField>
        </div>

        <div className="mt-4">
          <span className="block text-sm font-medium text-text">Important dates</span>
          <div className="mt-2 space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-wrap items-end gap-3">
                <FormField
                  label="Label"
                  htmlFor={`important_dates.${index}.label`}
                  error={errors.important_dates?.[index]?.label?.message}
                >
                  <Input
                    id={`important_dates.${index}.label`}
                    placeholder="e.g. Engagement dinner"
                    invalid={!!errors.important_dates?.[index]?.label}
                    {...register(`important_dates.${index}.label`)}
                  />
                </FormField>
                <FormField
                  label="Date"
                  htmlFor={`important_dates.${index}.date`}
                  error={errors.important_dates?.[index]?.date?.message}
                >
                  <Input
                    id={`important_dates.${index}.date`}
                    type="date"
                    invalid={!!errors.important_dates?.[index]?.date}
                    {...register(`important_dates.${index}.date`)}
                  />
                </FormField>
                <Button type="button" variant="ghost" onClick={() => remove(index)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => append({ id: crypto.randomUUID(), label: "", date: "" })}
          >
            Add important date
          </Button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Preferences</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Color palette" htmlFor="favorite_colors" error={errors.favorite_colors?.message}>
            <Input id="favorite_colors" invalid={!!errors.favorite_colors} {...register("favorite_colors")} />
          </FormField>
          <FormField label="Favorite flowers" htmlFor="favorite_flowers" error={errors.favorite_flowers?.message}>
            <Input id="favorite_flowers" invalid={!!errors.favorite_flowers} {...register("favorite_flowers")} />
          </FormField>
          <FormField label="Favorite music" htmlFor="favorite_music" error={errors.favorite_music?.message}>
            <Input id="favorite_music" invalid={!!errors.favorite_music} {...register("favorite_music")} />
          </FormField>
          <FormField label="Favorite food" htmlFor="favorite_food" error={errors.favorite_food?.message}>
            <Input id="favorite_food" invalid={!!errors.favorite_food} {...register("favorite_food")} />
          </FormField>
          <FormField label="Favorite drinks" htmlFor="favorite_drinks" error={errors.favorite_drinks?.message}>
            <Input id="favorite_drinks" invalid={!!errors.favorite_drinks} {...register("favorite_drinks")} />
          </FormField>
          <FormField label="Preferred style" htmlFor="preferred_style" error={errors.preferred_style?.message}>
            <Input id="preferred_style" invalid={!!errors.preferred_style} {...register("preferred_style")} />
          </FormField>
        </div>
        <FormField
          label="Disliked elements"
          htmlFor="disliked_elements"
          error={errors.disliked_elements?.message}
        >
          <Textarea
            id="disliked_elements"
            rows={2}
            invalid={!!errors.disliked_elements}
            {...register("disliked_elements")}
          />
        </FormField>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Important operational details</h3>
        <p className="mt-1 text-xs text-text-muted">
          Internal only — never shown on a future Client Portal.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Allergies" htmlFor="allergies" error={errors.allergies?.message}>
            <Input id="allergies" invalid={!!errors.allergies} {...register("allergies")} />
          </FormField>
          <FormField
            label="Accessibility needs"
            htmlFor="accessibility_needs"
            error={errors.accessibility_needs?.message}
          >
            <Input
              id="accessibility_needs"
              invalid={!!errors.accessibility_needs}
              {...register("accessibility_needs")}
            />
          </FormField>
          <FormField
            label="Dietary restrictions"
            htmlFor="dietary_restrictions"
            error={errors.dietary_restrictions?.message}
          >
            <Input
              id="dietary_restrictions"
              invalid={!!errors.dietary_restrictions}
              {...register("dietary_restrictions")}
            />
          </FormField>
          <FormField
            label="Communication notes"
            htmlFor="preferred_communication_time"
            hint="Preferred day/time to reach out"
            error={errors.preferred_communication_time?.message}
          >
            <Input
              id="preferred_communication_time"
              invalid={!!errors.preferred_communication_time}
              {...register("preferred_communication_time")}
            />
          </FormField>
          <FormField
            label="Emergency contact name"
            htmlFor="emergency_contact_name"
            error={errors.emergency_contact_name?.message}
          >
            <Input
              id="emergency_contact_name"
              invalid={!!errors.emergency_contact_name}
              {...register("emergency_contact_name")}
            />
          </FormField>
          <FormField
            label="Emergency contact phone"
            htmlFor="emergency_contact_phone"
            error={errors.emergency_contact_phone?.message}
          >
            <Input
              id="emergency_contact_phone"
              invalid={!!errors.emergency_contact_phone}
              {...register("emergency_contact_phone")}
            />
          </FormField>
        </div>
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm text-text">
            <Checkbox
              {...register("do_not_call")}
            />
            Do not call
          </label>
          <label className="flex items-center gap-2 text-sm text-text">
            <Checkbox
              {...register("surprise_event_confidentiality")}
            />
            Surprise-event confidentiality (keep outreach private from this client)
          </label>
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
