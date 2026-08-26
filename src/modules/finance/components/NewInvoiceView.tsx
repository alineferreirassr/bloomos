"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { createInvoice } from "@/lib/data";
import { InvoiceForm } from "@/modules/finance/components/InvoiceForm";
import { invoiceFormToInput, type InvoiceInput } from "@/modules/finance/schema";

interface NewInvoiceViewProps {
  /** Pre-fills the form when arriving from a Contract/Event's "Create Invoice" quick action — never assumed valid, still re-validated by the data layer on submit. */
  defaultClientId?: string;
  defaultEventId?: string;
  defaultContractId?: string;
}

/** Plain JSON-shaped payload (strings/numbers/null, fixed key order from invoiceFormToInput) — string comparison is a safe, simple deep-equality check. */
function invoicePayloadsEqual(a: InvoiceInput, b: InvoiceInput): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function NewInvoiceView({ defaultClientId, defaultEventId, defaultContractId }: NewInvoiceViewProps) {
  const router = useRouter();

  /**
   * Finance F2.1C-F-E-D-B1: invoiceId is generated lazily, exactly once per
   * page mount — same lifecycle NewPaymentView/NewPaymentSettlementView
   * use. lastPayload tracks what was actually submitted under the current
   * id: unset on the very first submit (reuse the id as-is), unchanged on a
   * retry (reuse the same id), and a new id is generated only when the
   * Founder edits the form after a failed attempt. Owned entirely here, not
   * inside InvoiceForm — InvoiceForm is shared with EditInvoiceView, which
   * must never inherit create-request identity.
   */
  const requestRef = useRef<{ id: string; lastPayload: InvoiceInput | null } | null>(null);
  if (requestRef.current === null) {
    requestRef.current = { id: crypto.randomUUID(), lastPayload: null };
  }

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
            const payload = invoiceFormToInput(input);
            const request = requestRef.current!;
            const payloadChanged = request.lastPayload !== null && !invoicePayloadsEqual(request.lastPayload, payload);
            const invoiceId = payloadChanged ? crypto.randomUUID() : request.id;
            requestRef.current = { id: invoiceId, lastPayload: payload };

            const result = await createInvoice(payload, invoiceId);
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
