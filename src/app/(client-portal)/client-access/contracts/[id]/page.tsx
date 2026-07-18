import { ClientPortalContractDetailView } from "@/modules/clientPortal/components/ClientPortalContractDetailView";

export default async function ClientPortalContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientPortalContractDetailView contractId={id} />;
}
