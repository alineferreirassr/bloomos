import { NewDocumentView } from "@/modules/documents/components/NewDocumentView";
import type { EntityType } from "@/core/enums/entityType";

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{
    ownerType?: string;
    ownerId?: string;
    clientId?: string;
    eventId?: string;
    contractId?: string;
    invoiceId?: string;
    paymentId?: string;
    expenseId?: string;
  }>;
}) {
  const { ownerType, ownerId, clientId, eventId, contractId, invoiceId, paymentId, expenseId } = await searchParams;
  return (
    <NewDocumentView
      defaultOwnerType={ownerType as EntityType | undefined}
      defaultOwnerId={ownerId}
      defaultClientId={clientId}
      defaultEventId={eventId}
      defaultContractId={contractId}
      defaultInvoiceId={invoiceId}
      defaultPaymentId={paymentId}
      defaultExpenseId={expenseId}
    />
  );
}
