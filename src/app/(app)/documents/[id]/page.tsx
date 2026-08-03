import { DocumentDetailView } from "@/modules/documents/components/DocumentDetailView";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentDetailView key={id} documentId={id} />;
}
