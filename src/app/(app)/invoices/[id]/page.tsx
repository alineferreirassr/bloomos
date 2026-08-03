import { InvoiceDetailView } from "@/modules/invoicePlatform/components/InvoiceDetailView";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceDetailView invoiceId={id} />;
}
