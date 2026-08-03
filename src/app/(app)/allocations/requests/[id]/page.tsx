import { AllocationRequestDetailView } from "@/modules/allocation/components/AllocationRequestDetailView";

export default async function AllocationRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AllocationRequestDetailView requestId={id} />;
}
