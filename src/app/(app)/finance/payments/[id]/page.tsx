import { PaymentDetailView } from "@/modules/finance/components/PaymentDetailView";

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PaymentDetailView key={id} paymentId={id} />;
}
