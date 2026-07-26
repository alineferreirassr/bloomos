"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";
import { classifyThrownError } from "@/modules/services/hooks/errorContract";
import type { ServiceInput } from "@/modules/services/schema";
import type { Service } from "@/types/service";
import type { ServiceCategory } from "@/types/serviceCategory";

/** RHF-friendly mirror of `ServiceInput` — plain strings only, so the native `<select>`/`<textarea>` never have to represent `null` themselves. Converted at the form's two boundaries (`toFormValues`/`toServiceInput`) instead of teaching every field how to round-trip null. */
interface IdentityFormValues {
  category_id: string;
  name: string;
  description: string;
}

function toFormValues(service: Service): IdentityFormValues {
  return { category_id: service.category_id ?? "", name: service.name, description: service.description ?? "" };
}

function toServiceInput(values: IdentityFormValues): ServiceInput {
  return {
    category_id: values.category_id || null,
    name: values.name.trim(),
    description: values.description.trim() || null,
  };
}

interface ServiceIdentityFormProps {
  service: Service;
  categories: ServiceCategory[];
  onSave: (input: ServiceInput) => Promise<Service>;
  readOnly: boolean;
  readOnlyReason?: string;
}

/**
 * Catalog-identity fields only (name/category/description) — status and
 * version fields live elsewhere. View mode by default; Save is explicit,
 * never per-keystroke, since a half-typed name shouldn't hit the network.
 * `canEditServiceCatalogFields` is the one workflow gate this respects
 * (`readOnly` reflects it, computed by the caller — this component never
 * re-derives it from `service.status` itself, so it stays purely
 * presentational about the *rule*, only responsible for the *interaction*).
 */
export function ServiceIdentityForm({ service, categories, onSave, readOnly, readOnlyReason }: ServiceIdentityFormProps) {
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
  } = useForm<IdentityFormValues>({ defaultValues: toFormValues(service) });

  // Moves focus into the form on entering edit mode, and back to the
  // trigger on leaving it — the same "focus follows the interaction, never
  // gets lost" contract Modal/Drawer already establish via
  // useDialogBehavior. Guarded by hasEditedOnceRef so mount (isEditing
  // starts false) never steals focus onto the Edit button unprompted.
  useEffect(() => {
    if (isEditing) {
      hasEditedOnceRef.current = true;
      setFocus("name");
    } else if (hasEditedOnceRef.current) {
      editButtonRef.current?.focus();
    }
  }, [isEditing, setFocus]);

  function startEditing() {
    reset(toFormValues(service));
    setFormError(null);
    setIsEditing(true);
  }

  function cancel() {
    reset(toFormValues(service));
    setFormError(null);
    setIsEditing(false);
  }

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSave(toServiceInput(values));
      setIsEditing(false);
    } catch (error) {
      const classified = classifyThrownError(error);
      setFormError(classified.message);
      if (classified.fieldErrors) {
        for (const [field, message] of Object.entries(classified.fieldErrors)) {
          if (message) setError(field as keyof IdentityFormValues, { message });
        }
      }
    }
  });

  if (!isEditing) {
    const categoryName = categories.find((category) => category.id === service.category_id)?.name ?? "No category";
    return (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-[17px] font-semibold text-text">{service.name}</h3>
            <p className="mt-1 text-sm text-text-muted">{categoryName}</p>
            {service.description ? <p className="mt-2 text-sm text-text">{service.description}</p> : null}
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
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError ? (
          <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <FormField label="Name" htmlFor="service_identity_name" required error={errors.name?.message}>
          <Input id="service_identity_name" invalid={!!errors.name} {...register("name", { required: "Name is required" })} />
        </FormField>
        <FormField label="Category" htmlFor="service_identity_category" error={errors.category_id?.message}>
          <Select id="service_identity_category" invalid={!!errors.category_id} {...register("category_id")}>
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Description" htmlFor="service_identity_description" error={errors.description?.message}>
          <Textarea id="service_identity_description" rows={3} invalid={!!errors.description} {...register("description")} />
        </FormField>
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
