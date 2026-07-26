"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";
import { ServicePrice } from "@/modules/services/components/ServicePrice";
import { classifyThrownError } from "@/modules/services/hooks/errorContract";
import { minorToMajor, majorToMinor } from "@/lib/money";
import { SERVICE_EXPERIENCE_LEVELS, SERVICE_EXPERIENCE_LEVEL_LABELS, type ServiceExperienceLevel } from "@/core/enums/serviceExperienceLevel";
import { SERVICE_WEATHER_SENSITIVITIES, SERVICE_WEATHER_SENSITIVITY_LABELS, type ServiceWeatherSensitivity } from "@/core/enums/serviceWeatherSensitivity";
import type { ServiceVersionInput } from "@/modules/services/schema";
import type { ServiceVersion } from "@/types/serviceVersion";

/** RHF-friendly mirror of `ServiceVersionInput` — every numeric/nullable field becomes a plain string so native inputs never have to represent `null` or a minor-unit integer directly. */
interface DraftVersionFormValues {
  base_price_major: string;
  currency: string;
  setup_duration_minutes: string;
  breakdown_duration_minutes: string;
  difficulty_score: string;
  experience_level_required: string;
  weather_sensitivity: ServiceWeatherSensitivity;
  surprise_friendly: boolean;
  estimated_profit_major: string;
}

function toFormValues(draft: ServiceVersion): DraftVersionFormValues {
  return {
    base_price_major: String(minorToMajor(draft.base_price_minor)),
    currency: draft.currency,
    setup_duration_minutes: draft.setup_duration_minutes != null ? String(draft.setup_duration_minutes) : "",
    breakdown_duration_minutes: draft.breakdown_duration_minutes != null ? String(draft.breakdown_duration_minutes) : "",
    difficulty_score: draft.difficulty_score != null ? String(draft.difficulty_score) : "",
    experience_level_required: draft.experience_level_required ?? "",
    weather_sensitivity: draft.weather_sensitivity,
    surprise_friendly: draft.surprise_friendly,
    estimated_profit_major: draft.estimated_profit_minor != null ? String(minorToMajor(draft.estimated_profit_minor)) : "",
  };
}

/** Locale-safe: `Number()` on a `type="number"` input's string value is always period-decimal regardless of the browser's display locale, so this never needs its own parsing beyond the `majorToMinor` rounding money.ts already does. */
function toServiceVersionInput(values: DraftVersionFormValues): ServiceVersionInput {
  return {
    base_price_minor: majorToMinor(Number(values.base_price_major) || 0),
    currency: values.currency.trim().toUpperCase(),
    setup_duration_minutes: values.setup_duration_minutes === "" ? null : Number(values.setup_duration_minutes),
    breakdown_duration_minutes: values.breakdown_duration_minutes === "" ? null : Number(values.breakdown_duration_minutes),
    difficulty_score: values.difficulty_score === "" ? null : Number(values.difficulty_score),
    experience_level_required: values.experience_level_required === "" ? null : (values.experience_level_required as ServiceExperienceLevel),
    weather_sensitivity: values.weather_sensitivity,
    surprise_friendly: values.surprise_friendly,
    estimated_profit_minor: values.estimated_profit_major === "" ? null : majorToMinor(Number(values.estimated_profit_major)),
  };
}

/** The two money fields are named `*_major` on this form (see `DraftVersionFormValues`) but `*_minor` on the wire — a server-side field error keyed `base_price_minor`/`estimated_profit_minor` needs translating to land on the right input. */
const SERVER_FIELD_TO_FORM_FIELD: Partial<Record<string, keyof DraftVersionFormValues>> = {
  base_price_minor: "base_price_major",
  estimated_profit_minor: "estimated_profit_major",
};

interface DraftVersionFormProps {
  draftVersion: ServiceVersion;
  onSave: (input: ServiceVersionInput) => Promise<ServiceVersion>;
  readOnly: boolean;
  readOnlyReason?: string;
}

/**
 * All 9 draft-version fields, grouped for readability (Pricing / Operational
 * metadata / Client communication / Profitability), but saved through ONE
 * explicit Save — `useUpdateServiceVersionDraft` takes the complete
 * `ServiceVersionInput` object, so there is no lower-impact partial-field
 * endpoint a per-field autosave could safely call; submitting on blur would
 * hit the network with the exact same shape as the main Save, which is the
 * opposite of "low-impact." The hybrid strategy the spec allows therefore
 * resolves to a single section here, not autosave anywhere.
 */
export function DraftVersionForm({ draftVersion, onSave, readOnly, readOnlyReason }: DraftVersionFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const hasEditedOnceRef = useRef(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<DraftVersionFormValues>({ defaultValues: toFormValues(draftVersion) });

  useEffect(() => {
    if (isEditing) {
      hasEditedOnceRef.current = true;
      setFocus("base_price_major");
    } else if (hasEditedOnceRef.current) {
      editButtonRef.current?.focus();
    }
  }, [isEditing, setFocus]);

  function startEditing() {
    reset(toFormValues(draftVersion));
    setFormError(null);
    setIsEditing(true);
  }

  function cancel() {
    reset(toFormValues(draftVersion));
    setFormError(null);
    setIsEditing(false);
  }

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSave(toServiceVersionInput(values));
      setIsEditing(false);
    } catch (error) {
      const classified = classifyThrownError(error);
      setFormError(classified.message);
      if (classified.fieldErrors) {
        for (const [field, message] of Object.entries(classified.fieldErrors)) {
          if (!message) continue;
          const formField = SERVER_FIELD_TO_FORM_FIELD[field] ?? (field as keyof DraftVersionFormValues);
          setError(formField, { message });
        }
      }
    }
  });

  if (!isEditing) {
    return (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-[17px] font-semibold text-text">Draft version</h3>
            <div className="mt-2">
              <ServicePrice amountMinor={draftVersion.base_price_minor} currency={draftVersion.currency} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <DetailRow label="Setup time" value={formatMinutes(draftVersion.setup_duration_minutes)} />
              <DetailRow label="Breakdown time" value={formatMinutes(draftVersion.breakdown_duration_minutes)} />
              <DetailRow label="Difficulty" value={draftVersion.difficulty_score != null ? `${draftVersion.difficulty_score} / 5` : "Not assessed"} />
              <DetailRow
                label="Experience required"
                value={draftVersion.experience_level_required ? SERVICE_EXPERIENCE_LEVEL_LABELS[draftVersion.experience_level_required] : "Not specified"}
              />
              <DetailRow label="Weather sensitivity" value={SERVICE_WEATHER_SENSITIVITY_LABELS[draftVersion.weather_sensitivity]} />
              <DetailRow label="Surprise-friendly" value={draftVersion.surprise_friendly ? "Yes" : "No"} />
              <DetailRow
                label="Estimated profit"
                value={draftVersion.estimated_profit_minor != null ? <ServicePrice amountMinor={draftVersion.estimated_profit_minor} currency={draftVersion.currency} variant="compact" /> : "Not set"}
              />
            </dl>
          </div>
          {readOnly ? (
            <Tooltip content={readOnlyReason ?? "This can't be edited right now."}>
              <Button type="button" variant="secondary" aria-disabled="true" onClick={(event) => event.preventDefault()} className="cursor-not-allowed opacity-45">
                Edit
              </Button>
            </Tooltip>
          ) : (
            <Button type="button" variant="secondary" ref={editButtonRef} onClick={startEditing}>
              Edit
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={submit} noValidate className="space-y-6">
        {formError ? (
          <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <div>
          <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">Pricing</h4>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <FormField label="Base price" htmlFor="draft_base_price" required error={errors.base_price_major?.message}>
              <Input
                id="draft_base_price"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                invalid={!!errors.base_price_major}
                {...register("base_price_major", { required: "Enter a price" })}
              />
            </FormField>
            <FormField label="Currency" htmlFor="draft_currency" required error={errors.currency?.message}>
              <Input id="draft_currency" maxLength={3} invalid={!!errors.currency} {...register("currency", { required: "Enter a 3-letter currency code" })} />
            </FormField>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">Operational metadata</h4>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <FormField label="Setup time (minutes)" htmlFor="draft_setup_duration" error={errors.setup_duration_minutes?.message}>
              <Input id="draft_setup_duration" type="number" min="0" invalid={!!errors.setup_duration_minutes} {...register("setup_duration_minutes")} />
            </FormField>
            <FormField label="Breakdown time (minutes)" htmlFor="draft_breakdown_duration" error={errors.breakdown_duration_minutes?.message}>
              <Input id="draft_breakdown_duration" type="number" min="0" invalid={!!errors.breakdown_duration_minutes} {...register("breakdown_duration_minutes")} />
            </FormField>
            <FormField label="Difficulty" htmlFor="draft_difficulty" error={errors.difficulty_score?.message}>
              <Select id="draft_difficulty" invalid={!!errors.difficulty_score} {...register("difficulty_score")}>
                <option value="">Not assessed</option>
                {[1, 2, 3, 4, 5].map((score) => (
                  <option key={score} value={score}>
                    {score}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Experience required" htmlFor="draft_experience_level" error={errors.experience_level_required?.message}>
              <Select id="draft_experience_level" invalid={!!errors.experience_level_required} {...register("experience_level_required")}>
                <option value="">Not specified</option>
                {SERVICE_EXPERIENCE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {SERVICE_EXPERIENCE_LEVEL_LABELS[level]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">Client communication</h4>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <FormField label="Weather sensitivity" htmlFor="draft_weather_sensitivity" error={errors.weather_sensitivity?.message}>
              <Select id="draft_weather_sensitivity" invalid={!!errors.weather_sensitivity} {...register("weather_sensitivity")}>
                {SERVICE_WEATHER_SENSITIVITIES.map((sensitivity) => (
                  <option key={sensitivity} value={sensitivity}>
                    {SERVICE_WEATHER_SENSITIVITY_LABELS[sensitivity]}
                  </option>
                ))}
              </Select>
            </FormField>
            <label htmlFor="draft_surprise_friendly" className="mt-6 flex items-center gap-2 text-sm text-text">
              <Checkbox id="draft_surprise_friendly" {...register("surprise_friendly")} />
              Surprise-friendly
            </label>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">Profitability</h4>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <FormField label="Estimated profit" htmlFor="draft_estimated_profit" error={errors.estimated_profit_major?.message}>
              <Input id="draft_estimated_profit" type="number" step="0.01" inputMode="decimal" invalid={!!errors.estimated_profit_major} {...register("estimated_profit_major")} />
            </FormField>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="secondary" onClick={cancel} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function formatMinutes(minutes: number | null): string {
  return minutes != null ? `${minutes} min` : "Not set";
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
    </>
  );
}
