"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { createPayment } from "@/lib/data";
import { PaymentForm } from "@/modules/finance/components/PaymentForm";
import { paymentFormToInput, type PaymentInput } from "@/modules/finance/schema";

interface NewPaymentViewProps {
  /** Pre-fills the form when arriving from an Invoice's "Record Payment" quick action — never assumed valid, still re-validated by the data layer on submit. */
  defaultClientId?: string;
  defaultInvoiceId?: string;
  defaultEventId?: string;
  defaultContractId?: string;
}

/** Plain JSON-shaped payload (strings/numbers/null, fixed key order from paymentFormToInput) — string comparison is a safe, simple deep-equality check. */
function paymentPayloadsEqual(a: PaymentInput, b: PaymentInput): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function NewPaymentView({
  defaultClientId,
  defaultInvoiceId,
  defaultEventId,
  defaultContractId,
}: NewPaymentViewProps) {
  const router = useRouter();

  /**
   * Finance F2.1C-F-E-C: paymentId is generated lazily, exactly once per
   * page mount (this page has no open/close modal lifecycle to key a
   * useMemo off of — a fresh mount, via navigating here again, is what
   * naturally starts the next logical payment's identity). lastPayload
   * tracks what was actually submitted under the current id: unset on the
   * very first submit (reuse the id as-is), unchanged on a retry (reuse
   * the same id), and a new id is generated only when the Founder edits
   * the form after a failed attempt. Owned entirely here, not inside
   * PaymentForm — NewPaymentSettlementView keeps its own, independent ref
   * so the two operations never share an identity.
   */
  const requestRef = useRef<{ id: string; lastPayload: PaymentInput | null } | null>(null);
  if (requestRef.current === null) {
    requestRef.current = { id: crypto.randomUUID(), lastPayload: null };
  }

  return (
    <div>
      <h2 className="font-serif text-3xl font-semibold text-text">Record Payment</h2>
      <div className="mt-6 max-w-3xl">
        <PaymentForm
          submitLabel="Record Payment"
          cancelHref="/finance/payments"
          defaultValues={{
            client_id: defaultClientId ?? "",
            invoice_id: defaultInvoiceId ?? "",
            event_id: defaultEventId ?? "",
            contract_id: defaultContractId ?? "",
          }}
          onSubmit={async (input) => {
            const payload = paymentFormToInput(input);
            const request = requestRef.current!;
            const payloadChanged = request.lastPayload !== null && !paymentPayloadsEqual(request.lastPayload, payload);
            const paymentId = payloadChanged ? crypto.randomUUID() : request.id;
            requestRef.current = { id: paymentId, lastPayload: payload };

            const result = await createPayment(payload, paymentId);
            if (result.success) {
              router.push(`/finance/payments/${result.data.id}`);
            }
            return result;
          }}
        />
      </div>
    </div>
  );
}
