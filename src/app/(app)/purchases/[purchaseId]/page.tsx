import { PurchaseDetailView } from "@/modules/purchases/components/PurchaseDetailView";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ purchaseId: string }>;
}) {
  const { purchaseId } = await params;
  return <PurchaseDetailView key={purchaseId} purchaseId={purchaseId} />;
}
