import { NewInvoiceView } from "@/modules/finance/components/NewInvoiceView";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; eventId?: string; contractId?: string }>;
}) {
  const { clientId, eventId, contractId } = await searchParams;
  return <NewInvoiceView defaultClientId={clientId} defaultEventId={eventId} defaultContractId={contractId} />;
}
