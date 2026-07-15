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
import { getClients, getContracts, getEvents, getInvoices } from "@/lib/data";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import { paymentFormSchema, type PaymentFormInput } from "@/modules/finance/schema";
import { PAYMENT_TYPE_LABELS, PAYMENT_TYPES } from "@/core/enums/paymentType";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/core/enums/paymentMethod";
import { formatMoney } from "@/lib/money";
import type { DataResult } from "@/lib/data/result";

interface PaymentFormProps {
  defaultValues?: Partial<PaymentFormInput>;
  onSubmit: (input: PaymentFormInput) => Promise<DataResult<Payment>>;
  submitLabel: string;
  cancelHref: string;
}

const emptyDefaults: PaymentFormInput = {
  invoice_id: "",
  client_id: "",
  event_id: "",
  contract_id: "",
  payment_type: "deposit",
  amount: "",
  currency: "USD",
  payment_method: "cash",
  reference: "",
  transaction_date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export function PaymentForm({ defaultValues, onSubmit, submitLabel, cancelHref }: PaymentFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[] | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PaymentFormInput>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });

  const [selectedClientId, setSelectedClientId] = useState(defaultValues?.client_id ?? "");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(defaultValues?.invoice_id ?? "");
  const clientIdField = register("client_id");
  const invoiceIdField = register("invoice_id");

  useEffect(() => {
    let cancelled = false;
    getClients().then((result) => {
      if (!cancelled) setClients(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Invoice/Event/Contract must all belong to the selected Client
  // (data-layer validated) — every dropdown is filtered to that Client's
  // own records, same "options may not exist yet" pattern InvoiceForm uses.
  useEffect(() => {
    let cancelled = false;
    const fetchRelated = selectedClientId
      ? Promise.all([
          getEvents({ clientId: selectedClientId, includeArchived: true }),
          getContracts({ clientId: selectedClientId, includeArchived: true }),
          getInvoices({ clientId: selectedClientId, includeArchived: true }),
        ])
      : Promise.resolve([[], [], []] as [Event[], Contract[], Invoice[]]);
    fetchRelated.then(([eventsResult, contractsResult, invoicesResult]) => {
      if (!cancelled) {
        setEvents(eventsResult);
        setContracts(contractsResult);
        setInvoices(invoicesResult);
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
    if (!invoices) return;
    if (defaultValues?.event_id) setValue("event_id", defaultValues.event_id, { shouldDirty: false });
    if (defaultValues?.contract_id) setValue("contract_id", defaultValues.contract_id, { shouldDirty: false });
    if (defaultValues?.invoice_id) setValue("invoice_id", defaultValues.invoice_id, { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices]);

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
          setError(field as keyof PaymentFormInput, { message });
        }
      }
    }
  });

  const selectedInvoice = invoices?.find((invoice) => invoice.id === selectedInvoiceId);

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
          <FormField label="Client" htmlFor="client_id" required error={errors.client_id?.message}>
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
              <option value="">{clients ? "Select a client" : "Loading clients…"}</option>
              {clients?.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.first_name} {client.last_name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Invoice"
            htmlFor="invoice_id"
            hint="Optional — filtered to the selected client"
            error={errors.invoice_id?.message}
          >
            <Select
              id="invoice_id"
              invalid={!!errors.invoice_id}
              disabled={!selectedClientId}
              {...invoiceIdField}
              onChange={(event) => {
                invoiceIdField.onChange(event);
                setSelectedInvoiceId(event.target.value);
              }}
            >
              <option value="">{selectedClientId ? "No linked invoice" : "Select a client first"}</option>
              {invoices?.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} — {invoice.title}
                </option>
              ))}
            </Select>
            {selectedInvoice ? (
              <p className="mt-1 text-xs text-text-muted">
                Remaining balance: {formatMoney(selectedInvoice.balance_minor, selectedInvoice.currency)}
              </p>
            ) : null}
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
        <h3 className="text-sm font-semibold text-text">Payment details</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Payment type" htmlFor="payment_type" required error={errors.payment_type?.message}>
            <Select id="payment_type" invalid={!!errors.payment_type} {...register("payment_type")}>
              {PAYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PAYMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Payment method" htmlFor="payment_method" required error={errors.payment_method?.message}>
            <Select id="payment_method" invalid={!!errors.payment_method} {...register("payment_method")}>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
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
            <Input
              id="transaction_date"
              type="date"
              invalid={!!errors.transaction_date}
              {...register("transaction_date")}
            />
          </FormField>
          <FormField
            label="Reference"
            htmlFor="reference"
            hint="A check number or provider transaction id — never a card or account number"
            error={errors.reference?.message}
          >
            <Input id="reference" invalid={!!errors.reference} {...register("reference")} />
          </FormField>
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
