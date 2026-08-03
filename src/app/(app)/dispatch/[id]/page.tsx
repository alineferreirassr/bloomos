import { DispatchDetailView } from "@/modules/dispatch/components/DispatchDetailView";

export default async function DispatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DispatchDetailView orderId={id} />;
}
