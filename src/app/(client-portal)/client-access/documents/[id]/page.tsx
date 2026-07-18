import { ClientPortalDocumentDetailView } from "@/modules/clientPortal/components/ClientPortalDocumentDetailView";

export default async function ClientPortalDocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientPortalDocumentDetailView documentId={id} />;
}
