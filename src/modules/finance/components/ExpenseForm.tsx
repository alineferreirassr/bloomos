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
import { getClients, getContracts, getEvents } from "@/lib/data";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { Contract } from "@/types/contract";
import type { Expense } from "@/types/expense";
import type { ExpenseStatus } from "@/core/enums/expenseStatus";
import { expenseFormSchema, type ExpenseFormInput } from "@/modules/finance/schema";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORIES } from "@/core/enums/expenseCategory";
import { ExpenseStatusBadge } from "@/modules/finance/components/ExpenseStatusBadge";
import type { DataResult } from "@/lib/data/result";

interface ExpenseFormProps {
  defaultValues?: Partial<ExpenseFormInput>;
  onSubmit: (input: ExpenseFormInput) => Promise<DataResult<Expense>>;
  submitLabel: string;
  cancelHref: string;
  /** Shown read-only in edit mode — status moves only through its own dedicated quick action (Approve/Mark Due/Mark Paid/...), never a plain form field. */
  currentStatus?: ExpenseStatus;
}

const emptyDefaults: ExpenseFormInput = {
  event_id: "",
  client_id: "",
  contract_id: "",
  supplier_id: "",
  team_member_id: "",
  category: "miscellaneous",
  description: "",
  amount: "",
  currency: "USD",
  transaction_date: new Date().toISOString().slice(0, 10),
  due_date: "",
  reimbursable: false,
  reference: "",
  notes: "",
};

export function ExpenseForm({ defaultValues, onSubmit, submitLabel, cancelHref, currentStatus }: ExpenseFormProps) {
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
  } = useForm<ExpenseFormInput>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });

  // Client is optional for Expense (a general business expense has none) —
  // the Event/Contract dropdowns are still filtered to it once set, same
  // rationale as InvoiceForm/PaymentForm, but nothing is disabled while it's
  // empty besides those two dependent dropdowns.
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
    if (!events) return;
    if (defaultValues?.event_id) setValue("event_id", defaultValues.event_id, { shouldDirty: false });
    if (defaultValues?.contract_id) setValue("contract_id", defaultValues.contract_id, { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

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
          setError(field as keyof ExpenseFormInput, { message });
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

      {currentStatus ? (
        <div>
          <span className="mb-1.5 block text-xs text-text/70">Status</span>
          <ExpenseStatusBadge status={currentStatus} />
          <p className="mt-1 text-xs text-text-muted">Changed through the quick actions on the expense detail page.</p>
        </div>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold text-text">Relations</h3>
        <p className="mt-1 text-xs text-text-muted">
          All optional — a general business expense has neither a Client nor an Event.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Client" htmlFor="client_id" error={errors.client_id?.message}>
            <Select
              id="client_id"
              invalid={!!errors.client_id}
              disabled={!clients}
              {...clientIdField}
              onChange={(event) => {
                clientIdField.onChange(event);
                setSelectedClientId(event.target.value);
              }}
            >
              <option value="">{clients ? "No linked client" : "Loading clients…"}</option>
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
        <h3 className="text-sm font-semibold text-text">Supplier &amp; team (placeholders)</h3>
        <p className="mt-1 text-xs text-text-muted">
          No Supplier or Team module exists yet — these are free-text placeholders for a future selector.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Supplier" htmlFor="supplier_id" error={errors.supplier_id?.message}>
            <Input id="supplier_id" invalid={!!errors.supplier_id} {...register("supplier_id")} />
          </FormField>
          <FormField label="Team member" htmlFor="team_member_id" error={errors.team_member_id?.message}>
            <Input id="team_member_id" invalid={!!errors.team_member_id} {...register("team_member_id")} />
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Expense details</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Category" htmlFor="category" required error={errors.category?.message}>
            <Select id="category" invalid={!!errors.category} {...register("category")}>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {EXPENSE_CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Amount"
            htmlFor="amount"
            required
            hint="Major units (e.g. 1250.00), converted to minor units before saving"
            error={errors.amount?.message}
          >
            <Input id="amount" type="number" min={0} step="0.01" invalid={!!errors.amount} {...register("amount")} />
          </FormField>
          <FormField
            label="Currency"
            htmlFor="currency"
            required
            hint="3-letter code, e.g. USD"
            error={errors.currency?.message}
          >
            <Input id="currency" maxLength={3} invalid={!!errors.currency} {...register("currency")} />
          </FormField>
          <FormField label="Transaction date" htmlFor="transaction_date" required error={errors.transaction_date?.message}>
            <Input id="transaction_date" type="date" invalid={!!errors.transaction_date} {...register("transaction_date")} />
          </FormField>
          <FormField label="Due date" htmlFor="due_date" error={errors.due_date?.message}>
            <Input id="due_date" type="date" invalid={!!errors.due_date} {...register("due_date")} />
          </FormField>
          <FormField label="Reference" htmlFor="reference" error={errors.reference?.message}>
            <Input id="reference" invalid={!!errors.reference} {...register("reference")} />
          </FormField>
        </div>
        <div className="mt-4">
          <FormField label="Description" htmlFor="description" required error={errors.description?.message}>
            <Textarea id="description" rows={2} invalid={!!errors.description} {...register("description")} />
          </FormField>
        </div>
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm text-text">
            <Checkbox
              {...register("reimbursable")}
            />
            Reimbursable
          </label>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Notes</h3>
        <div className="mt-3">
          <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
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
