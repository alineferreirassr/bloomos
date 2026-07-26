"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/forms/FormField";
import { getClients, getContracts, getEvents, getExpenses, getInvoices, getPayments, createDocumentFolder } from "@/lib/data";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import { DOCUMENT_VISIBILITIES, DOCUMENT_VISIBILITY_LABELS } from "@/core/enums/documentVisibility";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import type { EntityType } from "@/core/enums/entityType";
import { VALID_DOCUMENT_OWNER_TYPES, documentFolderFormSchema, type DocumentFolderFormInput } from "@/modules/documents/schema";
import { OWNER_TYPE_LABELS } from "@/modules/documents/components/DocumentFilters";
import { getFullName } from "@/lib/personName";

interface NewFolderModalProps {
  open: boolean;
  onClose: () => void;
}

const emptyDefaults: DocumentFolderFormInput = { name: "", description: "", visibility: "internal" };

export function NewFolderModal({ open, onClose }: NewFolderModalProps) {
  const router = useRouter();
  const [ownerType, setOwnerType] = useState<EntityType>("workspace");
  const [ownerId, setOwnerId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DocumentFolderFormInput>({ resolver: zodResolver(documentFolderFormSchema), defaultValues: emptyDefaults });

  useEffect(() => {
    if (!open) return;
    Promise.all([
      getClients({ includeArchived: true }),
      getEvents({ includeArchived: true }),
      getContracts({ includeArchived: true }),
      getInvoices({ includeArchived: true }),
      getPayments({}),
      getExpenses({ includeArchived: true }),
    ]).then(([c, e, k, i, p, x]) => {
      setClients(c);
      setEvents(e);
      setContracts(k);
      setInvoices(i);
      setPayments(p);
      setExpenses(x);
      setOwnerType("workspace");
      setOwnerId(CURRENT_WORKSPACE_ID);
      reset(emptyDefaults);
      setFormError(null);
    });
  }, [open, reset]);

  const ownerOptions: { id: string; label: string }[] =
    ownerType === "client"
      ? clients.map((c) => ({ id: c.id, label: getFullName(c) }))
      : ownerType === "event"
        ? events.map((e) => ({ id: e.id, label: e.title }))
        : ownerType === "contract"
          ? contracts.map((c) => ({ id: c.id, label: c.contract_number }))
          : ownerType === "invoice"
            ? invoices.map((i) => ({ id: i.id, label: i.invoice_number }))
            : ownerType === "payment"
              ? payments.map((p) => ({ id: p.id, label: p.reference ?? `Payment on ${p.transaction_date}` }))
              : ownerType === "expense"
                ? expenses.map((e) => ({ id: e.id, label: e.description }))
                : [];

  const handleOwnerTypeChange = (next: EntityType) => {
    setOwnerType(next);
    setOwnerId(next === "workspace" ? CURRENT_WORKSPACE_ID : "");
  };

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    if (!ownerId) {
      setFormError("Please select an owner.");
      return;
    }
    const result = await createDocumentFolder({
      owner_type: ownerType,
      owner_id: ownerId,
      parent_folder_id: null,
      name: values.name,
      description: values.description === "" ? null : values.description,
      sort_order: 0,
      visibility: values.visibility,
    });
    if (!result.success) {
      setFormError(result.error);
      return;
    }
    onClose();
    router.push(`/documents/folders/${result.data.id}`);
  });

  return (
    <Modal open={open} onClose={onClose} title="New Folder">
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {formError}
          </div>
        ) : null}
        <FormField label="Owner type" htmlFor="new_folder_owner_type" required>
          <Select id="new_folder_owner_type" value={ownerType} onChange={(event) => handleOwnerTypeChange(event.target.value as EntityType)}>
            {VALID_DOCUMENT_OWNER_TYPES.map((type) => (
              <option key={type} value={type}>
                {OWNER_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </FormField>
        {ownerType === "workspace" ? (
          <FormField label="Owner" htmlFor="new_folder_owner_display">
            <Input id="new_folder_owner_display" value="Amoré Bloom (Workspace)" disabled />
          </FormField>
        ) : (
          <FormField label="Owner" htmlFor="new_folder_owner_id" required>
            <Select id="new_folder_owner_id" value={ownerId} onChange={(event) => setOwnerId(event.target.value)} disabled={ownerOptions.length === 0}>
              <option value="">{ownerOptions.length === 0 ? "Loading…" : "Select an owner"}</option>
              {ownerOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Name" htmlFor="new_folder_name" required error={errors.name?.message}>
          <Input id="new_folder_name" invalid={!!errors.name} {...register("name")} />
        </FormField>
        <FormField label="Description" htmlFor="new_folder_description" error={errors.description?.message}>
          <Textarea id="new_folder_description" rows={2} invalid={!!errors.description} {...register("description")} />
        </FormField>
        <FormField label="Visibility" htmlFor="new_folder_visibility" required error={errors.visibility?.message}>
          <Select id="new_folder_visibility" invalid={!!errors.visibility} {...register("visibility")}>
            {DOCUMENT_VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {DOCUMENT_VISIBILITY_LABELS[v]}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create Folder"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
