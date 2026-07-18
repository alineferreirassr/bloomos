import { ClientPortalEventDetailView } from "@/modules/clientPortal/components/ClientPortalEventDetailView";

export default async function ClientPortalEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientPortalEventDetailView eventId={id} />;
}
