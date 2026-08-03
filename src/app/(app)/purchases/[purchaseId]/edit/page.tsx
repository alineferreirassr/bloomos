import { EditPurchaseView } from "@/modules/purchases/components/EditPurchaseView";

export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ purchaseId: string }>;
}) {
  const { purchaseId } = await params;
  return <EditPurchaseView purchaseId={purchaseId} />;
}
