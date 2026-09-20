"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { updateMediaKitBrandAction } from "@/modules/mediaKit/updateMediaKitBrandAction";
import type { MediaKit, MediaKitBrandInput } from "@/types/mediaKit";

interface BrandFormValues {
  headline: string;
  positioning_statement: string;
  brand_narrative: string;
  location_label: string;
  service_area: string;
  established_year: string;
  specialty_label: string;
}

function toFormValues(mediaKit: MediaKit): BrandFormValues {
  return {
    headline: mediaKit.headline ?? "",
    positioning_statement: mediaKit.positioning_statement ?? "",
    brand_narrative: mediaKit.brand_narrative ?? "",
    location_label: mediaKit.location_label ?? "",
    service_area: mediaKit.service_area ?? "",
    established_year: mediaKit.established_year ? String(mediaKit.established_year) : "",
    specialty_label: mediaKit.specialty_label ?? "",
  };
}

function toBrandInput(values: BrandFormValues): MediaKitBrandInput {
  const trimmedYear = values.established_year.trim();
  return {
    headline: values.headline.trim() || null,
    positioning_statement: values.positioning_statement.trim() || null,
    brand_narrative: values.brand_narrative.trim() || null,
    location_label: values.location_label.trim() || null,
    service_area: values.service_area.trim() || null,
    established_year: trimmedYear ? Number(trimmedYear) : null,
    specialty_label: values.specialty_label.trim() || null,
  };
}

interface MediaKitBrandEditorProps {
  mediaKit: MediaKit;
  /** Re-runs the Manager's own real read path after a successful save — the same callback identity already used by "Create Media Kit". */
  onChanged: () => void;
}

/**
 * MEDIAKIT-03 — edits only the identity/story/location fields `media_kits`
 * owns this checkpoint. `social_links`/`appearance` stay untouched here —
 * Social and Appearance keep their own future editors and own section
 * ownership.
 */
export function MediaKitBrandEditor({ mediaKit, onChanged }: MediaKitBrandEditorProps) {
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
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BrandFormValues>({ defaultValues: toFormValues(mediaKit) });

  useEffect(() => {
    if (!isEditing) reset(toFormValues(mediaKit));
  }, [mediaKit, isEditing, reset]);

  useEffect(() => {
    if (isEditing) {
      hasEditedOnceRef.current = true;
      setFocus("headline");
    } else if (hasEditedOnceRef.current) {
      editButtonRef.current?.focus();
    }
  }, [isEditing, setFocus]);

  function startEditing() {
    reset(toFormValues(mediaKit));
    setFormError(null);
    setIsEditing(true);
  }

  function cancel() {
    reset(toFormValues(mediaKit));
    setFormError(null);
    setIsEditing(false);
  }

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await updateMediaKitBrandAction(toBrandInput(values));
    if (!result.success) {
      setFormError(result.error);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          if (message) setError(field as keyof BrandFormValues, { message });
        }
      }
      return;
    }
    setIsEditing(false);
    onChanged();
  });

  const preview = watch();

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-[17px] font-semibold text-text">Brand</h3>
            <p className="mt-1 text-xs text-text-muted">The identity, story, and reach visitors see first.</p>
          </div>
          {!isEditing ? (
            <Button type="button" variant="secondary" ref={editButtonRef} onClick={startEditing}>
              Edit
            </Button>
          ) : null}
        </div>

        {!isEditing ? (
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-xs text-text-muted">Headline</dt>
              <dd className="mt-0.5 text-text">{mediaKit.headline || <span className="text-text-muted">Not set</span>}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Positioning Statement</dt>
              <dd className="mt-0.5 text-text">{mediaKit.positioning_statement || <span className="text-text-muted">Not set</span>}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Specialty</dt>
              <dd className="mt-0.5 text-text">{mediaKit.specialty_label || <span className="text-text-muted">Not set</span>}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Brand Story</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-text">{mediaKit.brand_narrative || <span className="text-text-muted">Not set</span>}</dd>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-text-muted">Based In</dt>
                <dd className="mt-0.5 text-text">{mediaKit.location_label || <span className="text-text-muted">Not set</span>}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Service Area</dt>
                <dd className="mt-0.5 text-text">{mediaKit.service_area || <span className="text-text-muted">Not set</span>}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Established</dt>
                <dd className="mt-0.5 text-text">{mediaKit.established_year ?? <span className="text-text-muted">Not set</span>}</dd>
              </div>
            </div>
          </dl>
        ) : (
          <form onSubmit={submit} noValidate className="mt-4 space-y-6">
            {formError ? (
              <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                {formError}
              </p>
            ) : null}

            <div className="space-y-4">
              <h4 className="text-[11px] tracking-[0.1em] text-text-muted uppercase">Identity</h4>
              <FormField label="Headline" htmlFor="brand_headline" hint="The first line visitors read." error={errors.headline?.message}>
                <Input id="brand_headline" maxLength={160} invalid={!!errors.headline} {...register("headline")} />
              </FormField>
              <FormField
                label="Positioning Statement"
                htmlFor="brand_positioning_statement"
                hint="One or two sentences on what makes you worth choosing."
                error={errors.positioning_statement?.message}
              >
                <Textarea id="brand_positioning_statement" rows={2} maxLength={400} invalid={!!errors.positioning_statement} {...register("positioning_statement")} />
              </FormField>
              <FormField label="Specialty" htmlFor="brand_specialty_label" hint="Your defining focus." error={errors.specialty_label?.message}>
                <Input id="brand_specialty_label" maxLength={160} invalid={!!errors.specialty_label} {...register("specialty_label")} />
              </FormField>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] tracking-[0.1em] text-text-muted uppercase">Story</h4>
              <FormField
                label="Brand Story"
                htmlFor="brand_narrative"
                hint="The longer narrative — your background, philosophy, or approach."
                error={errors.brand_narrative?.message}
              >
                <Textarea id="brand_narrative" rows={6} maxLength={4000} invalid={!!errors.brand_narrative} {...register("brand_narrative")} />
              </FormField>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] tracking-[0.1em] text-text-muted uppercase">Location &amp; Reach</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField label="Based In" htmlFor="brand_location_label" error={errors.location_label?.message}>
                  <Input id="brand_location_label" maxLength={160} invalid={!!errors.location_label} {...register("location_label")} />
                </FormField>
                <FormField label="Service Area" htmlFor="brand_service_area" error={errors.service_area?.message}>
                  <Input id="brand_service_area" maxLength={160} invalid={!!errors.service_area} {...register("service_area")} />
                </FormField>
                <FormField label="Established" htmlFor="brand_established_year" error={errors.established_year?.message}>
                  <Input id="brand_established_year" type="number" inputMode="numeric" invalid={!!errors.established_year} {...register("established_year")} />
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
        )}
      </Card>

      <div>
        <h4 className="mb-2 text-[11px] tracking-[0.1em] text-text-muted uppercase">Brand Preview</h4>
        <Card className="border-accent/20 bg-surface-tint">
          {preview.headline || preview.positioning_statement || preview.brand_narrative ? (
            <div className="space-y-3 py-2 text-center">
              {preview.specialty_label ? <p className="text-[11px] tracking-[0.15em] text-accent uppercase">{preview.specialty_label}</p> : null}
              <h2 className="font-serif text-2xl text-text">{preview.headline || "Your headline"}</h2>
              {preview.positioning_statement ? <p className="mx-auto max-w-xl text-sm text-text-muted italic">{preview.positioning_statement}</p> : null}
              {preview.location_label || preview.service_area || preview.established_year ? (
                <p className="text-xs text-text-muted">
                  {[preview.location_label, preview.service_area ? `Serving ${preview.service_area}` : null, preview.established_year ? `Est. ${preview.established_year}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              {preview.brand_narrative ? <p className="mx-auto max-w-xl whitespace-pre-wrap text-sm text-text">{preview.brand_narrative}</p> : null}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-text-muted">Your Brand Preview will appear here once you add a headline, positioning statement, or brand story.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
