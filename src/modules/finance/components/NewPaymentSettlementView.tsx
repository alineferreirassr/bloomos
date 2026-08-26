"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { recordPaymentSettlement } from "@/lib/data";
import { PaymentForm } from "@/modules/finance/components/PaymentForm";
import { paymentFormToInput, type PaymentInput } from "@/modules/finance/schema";

interface NewPaymentSettlementViewProps {
  defaultClientId?: string;
  defaultInvoiceId?: string;
  defaultEventId?: string;
  defaultContractId?: string;
}

/** Plain JSON-shaped payload (strings/numbers/null, fixed key order from paymentFormToInput) — string comparison is a safe, simple deep-equality check. */
function paymentPayloadsEqual(a: PaymentInput, b: PaymentInput): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * A Payment Settlement always posts as already-succeeded (no pending/
 * processing lifecycle), unlike createPayment — so this is a separate entry
 * point rather than a mode flag on NewPaymentView. Reuses PaymentForm as-is
 * with Stripe hidden, since no provider integration exists in this phase.
 */
export function NewPaymentSettlementView({
  defaultClientId,
  defaultInvoiceId,
  defaultEventId,
  defaultContractId,
}: NewPaymentSettlementViewProps) {
  const router = useRouter();

  /**
   * Finance F2.1C-F-E-C: paymentId is generated lazily, exactly once per
   * page mount — same lifecycle NewPaymentView uses, but its own
   * independent ref: Payment and Settlement must never share an identity,
   * since a shared ref here would let an edited Settlement retry
   * accidentally collide with (or replay) an unrelated New Payment
   * attempt if a Founder somehow had both flows' state alive at once.
   */
  const requestRef = useRef<{ id: string; lastPayload: PaymentInput | null } | null>(null);
  if (requestRef.current === null) {
    requestRef.current = { id: crypto.randomUUID(), lastPayload: null };
  }

  return (
    <div>
      <h2 className="font-serif text-3xl font-semibold text-text">Record Settlement</h2>
      <p className="mt-1 text-sm text-text-muted">
        Posts a payment directly to the ledger as settled. Use this for cash, check, or bank transfers already received.
      </p>
      <div className="mt-6 max-w-3xl">
        <PaymentForm
          submitLabel="Record Settlement"
          cancelHref="/finance/payments"
          excludeMethods={["stripe"]}
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

            const result = await recordPaymentSettlement(payload, paymentId);
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
