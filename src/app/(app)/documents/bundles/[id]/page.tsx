import { DocumentBundleDetailView } from "@/modules/documentTemplates/components/DocumentBundleDetailView";

export default async function DocumentBundleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentBundleDetailView key={id} bundleId={id} />;
}
