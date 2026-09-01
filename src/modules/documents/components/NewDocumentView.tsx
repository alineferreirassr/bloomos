"use client";

import { useRouter } from "next/navigation";
import { createDocumentMetadataAction as createDocumentMetadata } from "@/modules/documents/documentActions";
import { DocumentForm } from "@/modules/documents/components/DocumentForm";
import { documentMetadataFormToInput, type DocumentMetadataFormInput } from "@/modules/documents/schema";
import type { EntityType } from "@/core/enums/entityType";

interface NewDocumentViewProps {
  /** Prefills the form when arriving from a Client/Event/Contract/Invoice/Payment/Expense's "Add Document Metadata" quick action. */
  defaultOwnerType?: EntityType;
  defaultOwnerId?: string;
  defaultClientId?: string;
  defaultEventId?: string;
  defaultContractId?: string;
  defaultInvoiceId?: string;
  defaultPaymentId?: string;
  defaultExpenseId?: string;
}

export function NewDocumentView({
  defaultOwnerType,
  defaultOwnerId,
  defaultClientId,
  defaultEventId,
  defaultContractId,
  defaultInvoiceId,
  defaultPaymentId,
  defaultExpenseId,
}: NewDocumentViewProps) {
  const router = useRouter();

  const defaultValues: Partial<DocumentMetadataFormInput> = {
    owner_type: defaultOwnerType ?? "workspace",
    owner_id: defaultOwnerId ?? "",
    client_id: defaultClientId ?? "",
    event_id: defaultEventId ?? "",
    contract_id: defaultContractId ?? "",
    invoice_id: defaultInvoiceId ?? "",
    payment_id: defaultPaymentId ?? "",
    expense_id: defaultExpenseId ?? "",
  };

  return (
    <div>
      <h2 className="font-serif text-3xl font-semibold text-text">Add Document</h2>
      <div className="mt-6 max-w-3xl">
        <DocumentForm
          defaultValues={defaultValues}
          onSubmit={async (input) => {
            const result = await createDocumentMetadata(documentMetadataFormToInput(input));
            if (result.success) {
              router.push(`/documents/${result.data.id}`);
            }
            return result;
          }}
        />
      </div>
    </div>
  );
}
