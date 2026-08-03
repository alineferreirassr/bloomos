import { ExecutionPackageDetailView } from "@/modules/executionPackage/components/ExecutionPackageDetailView";

export default async function ExecutionPackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExecutionPackageDetailView packageId={id} />;
}
