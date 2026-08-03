import { InvoiceDetailView } from "@/modules/finance/components/InvoiceDetailView";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InvoiceDetailView key={id} invoiceId={id} />;
}
