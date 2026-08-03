import { OperationalPlanDetailView } from "@/modules/operationalPlanning/components/OperationalPlanDetailView";

export default async function OperationalPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OperationalPlanDetailView planId={id} />;
}
