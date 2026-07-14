import { EditLeadView } from "@/modules/leads/components/EditLeadView";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditLeadView leadId={id} />;
}
