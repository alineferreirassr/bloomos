import { ClientDetailView } from "@/modules/clients/components/ClientDetailView";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientDetailView key={id} clientId={id} />;
}
