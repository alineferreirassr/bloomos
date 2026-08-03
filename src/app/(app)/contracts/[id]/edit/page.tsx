import { EditContractView } from "@/modules/contracts/components/EditContractView";

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditContractView key={id} contractId={id} />;
}
