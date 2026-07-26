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
import { getClients, getContractTemplates, getEvents } from "@/lib/data";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { ContractTemplate } from "@/types/contractTemplate";
import type { Contract } from "@/types/contract";
import { contractFormSchema, type ContractFormInput } from "@/modules/contracts/schema";
import { CONTRACT_TEMPLATE_CATEGORY_LABELS } from "@/core/enums/contractTemplateCategory";
import type { DataResult } from "@/lib/data/result";

interface ContractFormProps {
  defaultValues?: Partial<ContractFormInput>;
  onSubmit: (input: ContractFormInput) => Promise<DataResult<Contract>>;
  submitLabel: string;
  cancelHref: string;
  /** True when editing an existing Contract — the Client can never be changed after creation (the data layer rejects it), so the field is disabled rather than left to fail on submit. */
  disableClientChange?: boolean;
  /** True for signed/completed/archived/cancelled/declined/expired Contracts — value/dates/deposit/currency stay visible but can't be edited, so an edit never silently alters financial terms. */
  lockCommercialTerms?: boolean;
}

const emptyDefaults: ContractFormInput = {
  client_id: "",
  event_id: "",
  template_id: "",
  title: "",
  description: "",
  effective_date: "",
  expiration_date: "",
  total_value: "",
  deposit_required: false,
  deposit_amount: "",
  currency: "USD",
  notes: "",
};

export function ContractForm({
  defaultValues,
  onSubmit,
  submitLabel,
  cancelHref,
  disableClientChange = false,
  lockCommercialTerms = false,
}: ContractFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[] | null>(null);
  const [templates, setTemplates] = useState<ContractTemplate[] | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ContractFormInput>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });

  // Tracked as local state (rather than react-hook-form's watch(), which the
  // React Compiler can't safely memoize) purely to drive conditional UI —
  // the Event dropdown's filter and the deposit amount field's visibility.
  // The registered fields below remain the source of truth submitted on save.
  const [selectedClientId, setSelectedClientId] = useState(defaultValues?.client_id ?? "");
  const [depositRequired, setDepositRequired] = useState(defaultValues?.deposit_required ?? false);
  const clientIdField = register("client_id");
  const depositRequiredField = register("deposit_required");

  useEffect(() => {
    let cancelled = false;
    Promise.all([getClients(), getContractTemplates()]).then(([clientsResult, templatesResult]) => {
      if (!cancelled) {
        setClients(clientsResult);
        setTemplates(templatesResult);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The selected Event must belong to the selected Client and Workspace, so
  // the dropdown is filtered to that Client's own Events (getEvents already
  // scopes to the current Workspace) — re-fetched whenever the Client
  // changes, same "options may not exist yet" pattern EventForm uses for its
  // Client select.
  useEffect(() => {
    let cancelled = false;
    const fetchEvents = selectedClientId
      ? getEvents({ clientId: selectedClientId, includeArchived: true })
      : Promise.resolve([]);
    fetchEvents.then((result) => {
      if (!cancelled) setEvents(result);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedClientId]);

  useEffect(() => {
    if (clients && defaultValues?.client_id) {
      setValue("client_id", defaultValues.client_id, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

  useEffect(() => {
    if (events && defaultValues?.event_id) {
      setValue("event_id", defaultValues.event_id, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  useEffect(() => {
    if (templates && defaultValues?.template_id) {
      setValue("template_id", defaultValues.template_id, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);

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
          setError(field as keyof ContractFormInput, { message });
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
        <h3 className="text-sm font-semibold text-text">Parties</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label="Client"
            htmlFor="client_id"
            required
            hint={disableClientChange ? "Can't be changed after creation" : undefined}
            error={errors.client_id?.message}
          >
            <Select
              id="client_id"
              invalid={!!errors.client_id}
              disabled={!clients || disableClientChange}
              {...clientIdField}
              onChange={(event) => {
                clientIdField.onChange(event);
                setSelectedClientId(event.target.value);
              }}
            >
              <option value="">{clients ? "Select a client" : "Loading clients…"}</option>
              {clients?.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.first_name} {client.last_name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Event"
            htmlFor="event_id"
            hint="Optional — filtered to the selected client"
            error={errors.event_id?.message}
          >
            <Select id="event_id" invalid={!!errors.event_id} disabled={!selectedClientId} {...register("event_id")}>
              <option value="">{selectedClientId ? "No linked event" : "Select a client first"}</option>
              {events?.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Contract basics</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Title" htmlFor="title" required error={errors.title?.message}>
            <Input id="title" invalid={!!errors.title} {...register("title")} />
          </FormField>
          <FormField label="Template" htmlFor="template_id" hint="Optional" error={errors.template_id?.message}>
            <Select
              id="template_id"
              invalid={!!errors.template_id}
              disabled={!templates}
              {...register("template_id")}
            >
              <option value="">{templates ? "No template" : "Loading templates…"}</option>
              {templates?.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({CONTRACT_TEMPLATE_CATEGORY_LABELS[template.category]})
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="mt-4">
          <FormField label="Description" htmlFor="description" error={errors.description?.message}>
            <Textarea id="description" rows={3} invalid={!!errors.description} {...register("description")} />
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Dates</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Effective date" htmlFor="effective_date" error={errors.effective_date?.message}>
            <Input
              id="effective_date"
              type="date"
              invalid={!!errors.effective_date}
              disabled={lockCommercialTerms}
              {...register("effective_date")}
            />
          </FormField>
          <FormField label="Expiration date" htmlFor="expiration_date" error={errors.expiration_date?.message}>
            <Input
              id="expiration_date"
              type="date"
              invalid={!!errors.expiration_date}
              disabled={lockCommercialTerms}
              {...register("expiration_date")}
            />
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">
          Financial terms{lockCommercialTerms ? " (locked)" : ""}
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Total value" htmlFor="total_value" error={errors.total_value?.message}>
            <Input
              id="total_value"
              type="number"
              min={0}
              step="0.01"
              invalid={!!errors.total_value}
              disabled={lockCommercialTerms}
              {...register("total_value")}
            />
          </FormField>
          <FormField
            label="Currency"
            htmlFor="currency"
            required
            hint="3-letter code, e.g. USD"
            error={errors.currency?.message}
          >
            <Input
              id="currency"
              maxLength={3}
              invalid={!!errors.currency}
              disabled={lockCommercialTerms}
              {...register("currency")}
            />
          </FormField>
        </div>
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm text-text">
            <Checkbox
              disabled={lockCommercialTerms}
              {...depositRequiredField}
              onChange={(event) => {
                depositRequiredField.onChange(event);
                setDepositRequired(event.target.checked);
              }}
            />
            Deposit required
          </label>
        </div>
        {depositRequired ? (
          <div className="mt-3 max-w-xs">
            <FormField label="Deposit amount" htmlFor="deposit_amount" required error={errors.deposit_amount?.message}>
              <Input
                id="deposit_amount"
                type="number"
                min={0}
                step="0.01"
                invalid={!!errors.deposit_amount}
                disabled={lockCommercialTerms}
                {...register("deposit_amount")}
              />
            </FormField>
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Internal notes</h3>
        <p className="mt-1 text-xs text-text-muted">Internal only — never shown to the client.</p>
        <div className="mt-3">
          <FormField label="Internal notes" htmlFor="notes" error={errors.notes?.message}>
            <Textarea id="notes" rows={3} invalid={!!errors.notes} {...register("notes")} />
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
