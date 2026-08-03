import { ComposedDocumentView } from "@/modules/documentTemplates/components/ComposedDocumentView";

export default async function ComposedDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ComposedDocumentView key={id} documentId={id} />;
}
