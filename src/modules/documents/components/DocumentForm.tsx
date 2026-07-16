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
import { Card } from "@/components/ui/Card";
import {
  getClients,
  getContractExhibitsByContractId,
  getContracts,
  getDocumentFolders,
  getEvents,
  getExpenses,
  getInvoices,
  getPayments,
} from "@/lib/data";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import type { ContractExhibit } from "@/types/contractExhibit";
import type { DocumentFolder } from "@/types/documentFolder";
import type { Document } from "@/types/document";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS } from "@/core/enums/documentCategory";
import { DOCUMENT_VISIBILITIES, DOCUMENT_VISIBILITY_LABELS } from "@/core/enums/documentVisibility";
import { ALLOWED_FILE_EXTENSIONS, BLOCKED_FILE_EXTENSIONS } from "@/lib/documentFile";
import { documentMetadataFormSchema, VALID_DOCUMENT_OWNER_TYPES, type DocumentMetadataFormInput } from "@/modules/documents/schema";
import { OWNER_TYPE_LABELS } from "@/modules/documents/components/DocumentFilters";
import { documentDefaultFormValues } from "@/modules/documents/mappers";
import type { DataResult } from "@/lib/data/result";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

interface DocumentFormProps {
  defaultValues?: Partial<DocumentMetadataFormInput>;
  onSubmit: (input: DocumentMetadataFormInput) => Promise<DataResult<Document>>;
}

/** documentMetadataInputSchema (authoritative) field names that differ from this form's own — everything else maps 1:1 by name. */
const AUTHORITATIVE_TO_FORM_FIELD: Partial<Record<string, string>> = {
  file_name: "original_file_name",
  size_bytes: "size_mb",
};

export function DocumentForm({ defaultValues, onSubmit }: DocumentFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[] | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [exhibits, setExhibits] = useState<ContractExhibit[]>([]);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DocumentMetadataFormInput>({
    resolver: zodResolver(documentMetadataFormSchema),
    defaultValues: documentDefaultFormValues(defaultValues),
  });

  const ownerType = watch("owner_type");
  const ownerId = watch("owner_id");
  const referenceContractId = watch("contract_id");
  const originalFileName = watch("original_file_name");

  useEffect(() => {
    if (ownerType === "workspace") {
      setValue("owner_id", CURRENT_WORKSPACE_ID, { shouldDirty: false });
    } else if (ownerId === CURRENT_WORKSPACE_ID) {
      setValue("owner_id", "", { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerType]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getClients({ includeArchived: true }), getEvents({ includeArchived: true }), getContracts({ includeArchived: true }), getInvoices({ includeArchived: true }), getPayments({}), getExpenses({ includeArchived: true })]).then(
      ([clientsResult, eventsResult, contractsResult, invoicesResult, paymentsResult, expensesResult]) => {
        if (cancelled) return;
        setClients(clientsResult);
        setEvents(eventsResult);
        setContracts(contractsResult);
        setInvoices(invoicesResult);
        setPayments(paymentsResult);
        setExpenses(expensesResult);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (ownerType === "workspace" || !ownerId) {
      setFolders([]);
      return;
    }
    getDocumentFolders({ ownerType, ownerId }).then((result) => {
      if (!cancelled) setFolders(result);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerType, ownerId]);

  useEffect(() => {
    let cancelled = false;
    if (!referenceContractId) {
      setExhibits([]);
      return;
    }
    getContractExhibitsByContractId(referenceContractId).then((result) => {
      if (!cancelled) setExhibits(result);
    });
    return () => {
      cancelled = true;
    };
  }, [referenceContractId]);

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
    router.push("/documents");
  };

  const ownerOptions: { id: string; label: string }[] =
    ownerType === "client"
      ? (clients ?? []).map((c) => ({ id: c.id, label: `${c.first_name} ${c.last_name}` }))
      : ownerType === "event"
        ? (events ?? []).map((e) => ({ id: e.id, label: e.title }))
        : ownerType === "contract"
          ? (contracts ?? []).map((c) => ({ id: c.id, label: c.contract_number }))
          : ownerType === "invoice"
            ? (invoices ?? []).map((i) => ({ id: i.id, label: i.invoice_number }))
            : ownerType === "payment"
              ? (payments ?? []).map((p) => ({ id: p.id, label: p.reference ?? `Payment on ${p.transaction_date}` }))
              : ownerType === "expense"
                ? (expenses ?? []).map((e) => ({ id: e.id, label: e.description }))
                : [];

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await onSubmit(values);
    if (!result.success) {
      setFormError(result.error);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          // The authoritative schema's field names (file_name, size_bytes) differ from this
          // form's (original_file_name, size_mb) — translate so the error lands on a field
          // that's actually registered, rather than being silently dropped by setError.
          const formField = AUTHORITATIVE_TO_FORM_FIELD[field] ?? field;
          setError(formField as keyof DocumentMetadataFormInput, { message });
        }
      }
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <Card className="border-accent/30 bg-accent/5">
        <p className="text-xs text-text-muted">
          <span className="font-medium text-text">This phase creates metadata only.</span> There is no real file
          selector or upload — the file name, MIME type, and size below simulate what a real upload would record.
          Extension, size limits, and blocked file types are still enforced. New documents always start as{" "}
          <span className="font-medium text-text">Draft</span>; activate from the detail page once ready.
        </p>
      </Card>

      {formError ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {formError}
        </div>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold text-text">Owner</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Owner type" htmlFor="owner_type" required error={errors.owner_type?.message}>
            <Select id="owner_type" invalid={!!errors.owner_type} {...register("owner_type")}>
              {VALID_DOCUMENT_OWNER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {OWNER_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </FormField>
          {ownerType === "workspace" ? (
            <FormField label="Owner" htmlFor="owner_id_display" required hint="Amoré Bloom (the current Workspace)">
              <Input id="owner_id_display" value="Amoré Bloom (Workspace)" disabled />
            </FormField>
          ) : (
            <FormField label="Owner" htmlFor="owner_id" required error={errors.owner_id?.message}>
              <Select id="owner_id" invalid={!!errors.owner_id} disabled={ownerOptions.length === 0} {...register("owner_id")}>
                <option value="">{ownerOptions.length === 0 ? "Loading…" : "Select an owner"}</option>
                {ownerOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField label="Folder" htmlFor="folder_id" hint="Optional — filtered to this owner" error={errors.folder_id?.message}>
            <Select id="folder_id" invalid={!!errors.folder_id} disabled={folders.length === 0} {...register("folder_id")}>
              <option value="">{folders.length === 0 ? "No folders for this owner" : "No folder"}</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Details</h3>
        <div className="mt-3">
          <FormField label="Title" htmlFor="title" hint="Optional — auto-generated from the file name when left blank" error={errors.title?.message}>
            <Input id="title" invalid={!!errors.title} {...register("title")} />
          </FormField>
        </div>
        <div className="mt-4">
          <FormField label="Description" htmlFor="description" error={errors.description?.message}>
            <Textarea id="description" rows={3} invalid={!!errors.description} {...register("description")} />
          </FormField>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Category" htmlFor="category" required error={errors.category?.message}>
            <Select id="category" invalid={!!errors.category} {...register("category")}>
              {DOCUMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {DOCUMENT_CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Visibility" htmlFor="visibility" required hint="Presentation only — not enforced yet" error={errors.visibility?.message}>
            <Select id="visibility" invalid={!!errors.visibility} {...register("visibility")}>
              {DOCUMENT_VISIBILITIES.map((visibility) => (
                <option key={visibility} value={visibility}>
                  {DOCUMENT_VISIBILITY_LABELS[visibility]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Simulated file</h3>
        <p className="mt-1 text-xs text-text-muted">
          No file is actually read or stored — these three fields describe the file this record represents.
          Allowed: {ALLOWED_FILE_EXTENSIONS.join(", ")}. Never allowed: {BLOCKED_FILE_EXTENSIONS.join(", ")}.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Original file name" htmlFor="original_file_name" required hint="e.g. Contract.pdf" error={errors.original_file_name?.message}>
            <Input id="original_file_name" invalid={!!errors.original_file_name} {...register("original_file_name")} />
          </FormField>
          <FormField label="MIME type" htmlFor="mime_type" required hint="e.g. application/pdf" error={errors.mime_type?.message}>
            <Input id="mime_type" invalid={!!errors.mime_type} {...register("mime_type")} />
          </FormField>
          <FormField label="Size (MB)" htmlFor="size_mb" required error={errors.size_mb?.message}>
            <Input id="size_mb" type="number" min={0} step="0.01" invalid={!!errors.size_mb} {...register("size_mb")} />
          </FormField>
        </div>
        {originalFileName ? (
          <p className="mt-2 text-xs text-text-muted">
            Will be stored as a normalized system file name (lowercased, safe characters) once created.
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Expiration</h3>
        <div className="mt-3 max-w-xs">
          <FormField label="Expiration date" htmlFor="expires_at" hint="Optional" error={errors.expires_at?.message}>
            <Input id="expires_at" type="date" invalid={!!errors.expires_at} {...register("expires_at")} />
          </FormField>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-text">Cross-module references</h3>
        <p className="mt-1 text-xs text-text-muted">
          Optional — for navigation and lookup only, separate from the Owner above.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField label="Client" htmlFor="client_id" error={errors.client_id?.message}>
            <Select id="client_id" invalid={!!errors.client_id} disabled={!clients} {...register("client_id")}>
              <option value="">None</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Event" htmlFor="event_id" error={errors.event_id?.message}>
            <Select id="event_id" invalid={!!errors.event_id} disabled={!events} {...register("event_id")}>
              <option value="">None</option>
              {events?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Contract" htmlFor="contract_id" error={errors.contract_id?.message}>
            <Select id="contract_id" invalid={!!errors.contract_id} disabled={!contracts} {...register("contract_id")}>
              <option value="">None</option>
              {contracts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contract_number}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Contract Exhibit" htmlFor="contract_exhibit_id" hint="Filtered to the selected Contract" error={errors.contract_exhibit_id?.message}>
            <Select id="contract_exhibit_id" invalid={!!errors.contract_exhibit_id} disabled={exhibits.length === 0} {...register("contract_exhibit_id")}>
              <option value="">{exhibits.length === 0 ? "Select a contract first" : "None"}</option>
              {exhibits.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Invoice" htmlFor="invoice_id" error={errors.invoice_id?.message}>
            <Select id="invoice_id" invalid={!!errors.invoice_id} disabled={!invoices} {...register("invoice_id")}>
              <option value="">None</option>
              {invoices?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoice_number}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Payment" htmlFor="payment_id" error={errors.payment_id?.message}>
            <Select id="payment_id" invalid={!!errors.payment_id} disabled={!payments} {...register("payment_id")}>
              <option value="">None</option>
              {payments?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.reference ?? `Payment on ${p.transaction_date}`}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Expense" htmlFor="expense_id" error={errors.expense_id?.message}>
            <Select id="expense_id" invalid={!!errors.expense_id} disabled={!expenses} {...register("expense_id")}>
              <option value="">None</option>
              {expenses?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.description}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Add Document"}
        </Button>
        <Button type="button" variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
