import { registerMergeField } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver } from "@/core/documents/mergeEngine";
import { getPayments } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import type { MergeFieldDefinition } from "@/types/documentPlatform";
import type { Payment } from "@/types/payment";

function mostRecentReceivedPayment(payments: Payment[]): Payment | null {
  const succeeded = payments.filter((payment) => payment.status === "succeeded");
  if (succeeded.length === 0) return null;
  return succeeded.slice().sort((a, b) => (b.received_at ?? b.transaction_date).localeCompare(a.received_at ?? a.transaction_date))[0];
}

/**
 * The `"payments"` Merge Field domain (v2 Checkpoint 44) — the most
 * recent received Payment against the linked Invoice, resolved from
 * `context.invoiceId`. Distinct from `"finance"`'s own `invoice_*` fields
 * (the Invoice's own totals/balance) — this is about the last real
 * payment transaction, for a "Payment Received" email/receipt.
 */
export const paymentsMergeFieldDefinitions: MergeFieldDefinition[] = [
  { key: "last_payment_amount", label: "Last Payment Amount", description: "The most recent received Payment against the linked Invoice, formatted as currency.", domain: "payments", valueType: "currency", required: false },
  { key: "last_payment_date", label: "Last Payment Date", description: "The date of the most recent received Payment against the linked Invoice.", domain: "payments", valueType: "date", required: false },
  { key: "last_payment_method", label: "Last Payment Method", description: "The payment method of the most recent received Payment against the linked Invoice.", domain: "payments", valueType: "string", required: false },
];

export function registerPaymentsMergeFields(): void {
  for (const definition of paymentsMergeFieldDefinitions) registerMergeField(definition);

  registerMergeResolver("last_payment_amount", async (context) => {
    if (!context.invoiceId) return null;
    const payments = await getPayments({ invoiceId: context.invoiceId }).catch(() => []);
    const payment = mostRecentReceivedPayment(payments);
    return payment ? formatMoney(payment.amount_minor, payment.currency) : null;
  });

  registerMergeResolver("last_payment_date", async (context) => {
    if (!context.invoiceId) return null;
    const payments = await getPayments({ invoiceId: context.invoiceId }).catch(() => []);
    const payment = mostRecentReceivedPayment(payments);
    return payment?.received_at ?? payment?.transaction_date ?? null;
  });

  registerMergeResolver("last_payment_method", async (context) => {
    if (!context.invoiceId) return null;
    const payments = await getPayments({ invoiceId: context.invoiceId }).catch(() => []);
    const payment = mostRecentReceivedPayment(payments);
    return payment?.payment_method ?? null;
  });
}
