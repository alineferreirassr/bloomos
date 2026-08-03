import { NewExpenseView } from "@/modules/finance/components/NewExpenseView";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; eventId?: string; contractId?: string }>;
}) {
  const { clientId, eventId, contractId } = await searchParams;
  return <NewExpenseView defaultClientId={clientId} defaultEventId={eventId} defaultContractId={contractId} />;
}
