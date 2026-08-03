import { EditDocumentView } from "@/modules/documents/components/EditDocumentView";

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditDocumentView key={id} documentId={id} />;
}
