"use client";

import { useRouter } from "next/navigation";
import { createInvoice } from "@/lib/data";
import { InvoiceForm } from "@/modules/finance/components/InvoiceForm";
import { invoiceFormToInput } from "@/modules/finance/schema";

interface NewInvoiceViewProps {
  /** Pre-fills the form when arriving from a Contract/Event's "Create Invoice" quick action — never assumed valid, still re-validated by the data layer on submit. */
  defaultClientId?: string;
  defaultEventId?: string;
  defaultContractId?: string;
}

export function NewInvoiceView({ defaultClientId, defaultEventId, defaultContractId }: NewInvoiceViewProps) {
  const router = useRouter();

  return (
    <div>
      <h2 className="font-serif text-3xl font-semibold text-text">New Invoice</h2>
      <div className="mt-6 max-w-3xl">
        <InvoiceForm
          submitLabel="Create Invoice"
          cancelHref="/finance/invoices"
          defaultValues={{
            client_id: defaultClientId ?? "",
            event_id: defaultEventId ?? "",
            contract_id: defaultContractId ?? "",
          }}
          onSubmit={async (input) => {
            const result = await createInvoice(invoiceFormToInput(input));
            if (result.success) {
              router.push(`/finance/invoices/${result.data.id}`);
            }
            return result;
          }}
        />
      </div>
    </div>
  );
}
