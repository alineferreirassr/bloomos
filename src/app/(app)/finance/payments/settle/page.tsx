import { NewPaymentSettlementView } from "@/modules/finance/components/NewPaymentSettlementView";

export default async function NewPaymentSettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; invoiceId?: string; eventId?: string; contractId?: string }>;
}) {
  const { clientId, invoiceId, eventId, contractId } = await searchParams;
  return (
    <NewPaymentSettlementView
      defaultClientId={clientId}
      defaultInvoiceId={invoiceId}
      defaultEventId={eventId}
      defaultContractId={contractId}
    />
  );
}
