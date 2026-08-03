import { FieldOperationDetailView } from "@/modules/fieldOperations/components/FieldOperationDetailView";

export default async function FieldOperationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FieldOperationDetailView operationId={id} />;
}
