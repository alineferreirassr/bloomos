import { AlertDetailView } from "@/modules/operationsCenter/components/AlertDetailView";

export default async function OperationalAlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AlertDetailView alertId={id} />;
}
