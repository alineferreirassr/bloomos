import { ClientPortalInvoiceDetailView } from "@/modules/clientPortal/components/ClientPortalInvoiceDetailView";

export default async function ClientPortalInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientPortalInvoiceDetailView invoiceId={id} />;
}
