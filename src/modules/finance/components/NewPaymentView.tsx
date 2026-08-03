"use client";

import { useRouter } from "next/navigation";
import { createPayment } from "@/lib/data";
import { PaymentForm } from "@/modules/finance/components/PaymentForm";
import { paymentFormToInput } from "@/modules/finance/schema";

interface NewPaymentViewProps {
  /** Pre-fills the form when arriving from an Invoice's "Record Payment" quick action — never assumed valid, still re-validated by the data layer on submit. */
  defaultClientId?: string;
  defaultInvoiceId?: string;
  defaultEventId?: string;
  defaultContractId?: string;
}

export function NewPaymentView({
  defaultClientId,
  defaultInvoiceId,
  defaultEventId,
  defaultContractId,
}: NewPaymentViewProps) {
  const router = useRouter();

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
            const result = await createPayment(paymentFormToInput(input));
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
