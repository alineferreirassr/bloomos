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
import { getClients, getContracts, getEvents } from "@/lib/data";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import { invoiceFormSchema, type InvoiceFormInput } from "@/modules/finance/schema";
import type { DataResult } from "@/lib/data/result";

interface InvoiceFormProps {
  defaultValues?: Partial<InvoiceFormInput>;
  onSubmit: (input: InvoiceFormInput) => Promise<DataResult<Invoice>>;
  submitLabel: string;
  cancelHref: string;
  /** True when editing an existing Invoice — the Client can never be changed after creation (the data layer rejects it), so the field is disabled rather than left to fail on submit. */
  disableClientChange?: boolean;
}

const emptyDefaults: InvoiceFormInput = {
  client_id: "",
  event_id: "",
  contract_id: "",
  title: "",
  description: "",
  issue_date: "",
  due_date: "",
  subtotal: "",
  tax: "",
  discount: "",
  currency: "USD",
  notes: "",
};

export function InvoiceForm({
  defaultValues,
  onSubmit,
  submitLabel,
  cancelHref,
  disableClientChange = false,
}: InvoiceFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[] | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<InvoiceFormInput>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });

  // Local state purely to drive the Event/Contract dropdowns' Client filter —
  // same rationale as ContractForm's selectedClientId (react-hook-form's
  // watch() can't be safely memoized by the React Compiler).
  const [selectedClientId, setSelectedClientId] = useState(defaultValues?.client_id ?? "");
  const clientIdField = register("client_id");

  useEffect(() => {
    let cancelled = false;
    getClients().then((result) => {
      if (!cancelled) setClients(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Event and Contract must both belong to the selected Client (data-layer
  // validated) — the dropdowns are filtered to that Client's own records,
  // same "options may not exist yet" pattern ContractForm uses for Event.
  useEffect(() => {
    let cancelled = false;
    const fetchRelated = selectedClientId
      ? Promise.all([
          getEvents({ clientId: selectedClientId, includeArchived: true }),
          getContracts({ clientId: selectedClientId, includeArchived: true }),
        ])
      : Promise.resolve([[], []] as [Event[], Contract[]]);
    fetchRelated.then(([eventsResult, contractsResult]) => {
      if (!cancelled) {
        setEvents(eventsResult);
        setContracts(contractsResult);
      }
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
    if (contracts && defaultValues?.contract_id) {
      setValue("contract_id", defaultValues.contract_id, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts]);

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
            setError(field as keyof InvoiceFormInput, { message });
          }
        }
      }
    } catch {
      // A genuinely unexpected failure (network/auth/out-of-taxonomy error)
      // throws rather than resolving a DataResult — same contract every
      // Finance mutation shares. React Hook Form already resets
      // formState.isSubmitting on a thrown submit callback, so no local
      // submitting state is needed here. onSubmit itself decides whether to
      // navigate on success, so a throw here safely never navigates; the
      // form remains open with every entered value intact for a safe retry.
      setFormError("Something went wrong. Please try again.");
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
          <div />
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
          <FormField
            label="Contract"
            htmlFor="contract_id"
            hint="Optional — filtered to the selected client"
            error={errors.contract_id?.message}
          >
            <Select
              id="contract_id"
              invalid={!!errors.contract_id}
              disabled={!selectedClientId}
              {...register("contract_id")}
            >
              <option value="">{selectedClientId ? "No linked contract" : "Select a client first"}</option>
              {contracts?.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.contract_number} — {contract.title}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Invoice basics</h3>
        <div className="mt-3">
          <FormField label="Title" htmlFor="title" required error={errors.title?.message}>
            <Input id="title" invalid={!!errors.title} {...register("title")} />
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
          <FormField label="Issue date" htmlFor="issue_date" error={errors.issue_date?.message}>
            <Input id="issue_date" type="date" invalid={!!errors.issue_date} {...register("issue_date")} />
          </FormField>
          <FormField label="Due date" htmlFor="due_date" error={errors.due_date?.message}>
            <Input id="due_date" type="date" invalid={!!errors.due_date} {...register("due_date")} />
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Financial terms</h3>
        <p className="mt-1 text-xs text-text-muted">
          Amounts are entered in major units (e.g. 1250.00) and converted to minor units before saving. Total and
          balance are calculated automatically.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Subtotal" htmlFor="subtotal" required error={errors.subtotal?.message}>
            <Input id="subtotal" type="number" min={0} step="0.01" invalid={!!errors.subtotal} {...register("subtotal")} />
          </FormField>
          <FormField label="Tax" htmlFor="tax" error={errors.tax?.message}>
            <Input id="tax" type="number" min={0} step="0.01" invalid={!!errors.tax} {...register("tax")} />
          </FormField>
          <FormField label="Discount" htmlFor="discount" error={errors.discount?.message}>
            <Input id="discount" type="number" min={0} step="0.01" invalid={!!errors.discount} {...register("discount")} />
          </FormField>
        </div>
        <div className="mt-4 max-w-xs">
          <FormField
            label="Currency"
            htmlFor="currency"
            required
            hint="3-letter code, e.g. USD"
            error={errors.currency?.message}
          >
            <Input id="currency" maxLength={3} invalid={!!errors.currency} {...register("currency")} />
          </FormField>
        </div>
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
