import { NewPaymentView } from "@/modules/finance/components/NewPaymentView";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; invoiceId?: string; eventId?: string; contractId?: string }>;
}) {
  const { clientId, invoiceId, eventId, contractId } = await searchParams;
  return (
    <NewPaymentView
      defaultClientId={clientId}
      defaultInvoiceId={invoiceId}
      defaultEventId={eventId}
      defaultContractId={contractId}
    />
  );
}
