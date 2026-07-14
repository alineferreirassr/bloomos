import { EditClientView } from "@/modules/clients/components/EditClientView";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditClientView clientId={id} />;
}
