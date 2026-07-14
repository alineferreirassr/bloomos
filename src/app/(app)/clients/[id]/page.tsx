import { ClientProofView } from "@/modules/clients/components/ClientProofView";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientProofView clientId={id} />;
}
