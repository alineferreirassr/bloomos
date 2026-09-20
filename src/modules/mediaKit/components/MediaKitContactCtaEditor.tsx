"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { updateMediaKitContactCtaAction } from "@/modules/mediaKit/updateMediaKitContactCtaAction";
import type { MediaKit, MediaKitContactCtaInput, MediaKitCtaType } from "@/types/mediaKit";

interface ContactCtaFormValues {
  contact_headline: string;
  contact_subtext: string;
  primary_cta_label: string;
  primary_cta_type: MediaKitCtaType;
  primary_cta_external_url: string;
  secondary_cta_label: string;
  secondary_cta_url: string;
}

function toFormValues(mediaKit: MediaKit): ContactCtaFormValues {
  return {
    contact_headline: mediaKit.contact_headline ?? "",
    contact_subtext: mediaKit.contact_subtext ?? "",
    primary_cta_label: mediaKit.primary_cta_label,
    primary_cta_type: mediaKit.primary_cta_type,
    primary_cta_external_url: mediaKit.primary_cta_external_url ?? "",
    secondary_cta_label: mediaKit.secondary_cta_label ?? "",
    secondary_cta_url: mediaKit.secondary_cta_url ?? "",
  };
}

function toInput(values: ContactCtaFormValues): MediaKitContactCtaInput {
  return {
    contact_headline: values.contact_headline.trim() || null,
    contact_subtext: values.contact_subtext.trim() || null,
    primary_cta_label: values.primary_cta_label.trim(),
    primary_cta_type: values.primary_cta_type,
    primary_cta_external_url: values.primary_cta_external_url.trim() || null,
    secondary_cta_label: values.secondary_cta_label.trim() || null,
    secondary_cta_url: values.secondary_cta_url.trim() || null,
  };
}

interface MediaKitContactCtaEditorProps {
  mediaKit: MediaKit;
  onChanged: () => void;
}

/**
 * MEDIAKIT-05 — real editor over `media_kits`' own contact/CTA columns
 * only. `primary_cta_type = "inquiry_form"` routes the public CTA to the
 * on-page CRM inquiry form; `"external_url"` sends visitors to
 * `primary_cta_external_url` instead (e.g. an outside booking calendar).
 */
export function MediaKitContactCtaEditor({ mediaKit, onChanged }: MediaKitContactCtaEditorProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactCtaFormValues>({ defaultValues: toFormValues(mediaKit) });

  useEffect(() => {
    reset(toFormValues(mediaKit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaKit]);

  const ctaType = watch("primary_cta_type");

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    setSaved(false);
    const result = await updateMediaKitContactCtaAction(toInput(values));
    if (!result.success) {
      setFormError(result.error);
      return;
    }
    setSaved(true);
    onChanged();
  });

  return (
    <Card>
      <div>
        <h3 className="font-serif text-[17px] font-semibold text-text">Contact &amp; CTA</h3>
        <p className="mt-1 text-xs text-text-muted">How visitors reach out, and where their inquiry goes.</p>
      </div>

      <form onSubmit={submit} noValidate className="mt-4 space-y-6">
        {formError ? (
          <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        ) : null}
        {saved ? <p className="text-xs text-success">Saved.</p> : null}

        <div className="space-y-4">
          <h4 className="text-[11px] tracking-[0.1em] text-text-muted uppercase">Contact Section</h4>
          <FormField label="Heading" htmlFor="contact_headline" hint='e.g. "Work With Us"' error={errors.contact_headline?.message}>
            <Input id="contact_headline" maxLength={160} {...register("contact_headline")} />
          </FormField>
          <FormField label="Supporting Text" htmlFor="contact_subtext" error={errors.contact_subtext?.message}>
            <Textarea id="contact_subtext" rows={2} maxLength={400} {...register("contact_subtext")} />
          </FormField>
        </div>

        <div className="space-y-4">
          <h4 className="text-[11px] tracking-[0.1em] text-text-muted uppercase">Primary Call-to-Action</h4>
          <FormField label="Label" htmlFor="primary_cta_label" required error={errors.primary_cta_label?.message}>
            <Input id="primary_cta_label" maxLength={60} {...register("primary_cta_label", { required: "CTA label is required." })} />
          </FormField>
          <FormField label="Behavior" htmlFor="primary_cta_type">
            <Select id="primary_cta_type" {...register("primary_cta_type")}>
              <option value="inquiry_form">Open the inquiry form</option>
              <option value="external_url">Link to an external URL</option>
            </Select>
          </FormField>
          {ctaType === "external_url" ? (
            <FormField label="External URL" htmlFor="primary_cta_external_url" required error={errors.primary_cta_external_url?.message}>
              <Input id="primary_cta_external_url" type="url" placeholder="https://" {...register("primary_cta_external_url")} />
            </FormField>
          ) : null}
        </div>

        <div className="space-y-4">
          <h4 className="text-[11px] tracking-[0.1em] text-text-muted uppercase">Secondary Call-to-Action</h4>
          <FormField label="Label" htmlFor="secondary_cta_label" hint="Optional.">
            <Input id="secondary_cta_label" maxLength={60} {...register("secondary_cta_label")} />
          </FormField>
          <FormField label="URL" htmlFor="secondary_cta_url" hint="Optional." error={errors.secondary_cta_url?.message}>
            <Input id="secondary_cta_url" type="url" placeholder="https://" {...register("secondary_cta_url")} />
          </FormField>
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save"}
        </Button>
      </form>
    </Card>
  );
}
