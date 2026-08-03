import { IncidentDetailView } from "@/modules/operationsCenter/components/IncidentDetailView";

export default async function OperationalIncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IncidentDetailView incidentId={id} />;
}
