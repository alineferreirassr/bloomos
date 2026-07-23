"use client";

import { useRouter } from "next/navigation";
import { recordPaymentSettlement } from "@/lib/data";
import { PaymentForm } from "@/modules/finance/components/PaymentForm";
import { paymentFormToInput } from "@/modules/finance/schema";

interface NewPaymentSettlementViewProps {
  defaultClientId?: string;
  defaultInvoiceId?: string;
  defaultEventId?: string;
  defaultContractId?: string;
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
            const result = await recordPaymentSettlement(paymentFormToInput(input));
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
