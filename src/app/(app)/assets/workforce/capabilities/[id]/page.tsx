import { RequirementDetailView } from "@/modules/capability/components/RequirementDetailView";

export default async function CapabilityRequirementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequirementDetailView requirementId={id} />;
}
