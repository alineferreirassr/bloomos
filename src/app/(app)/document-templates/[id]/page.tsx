import { TemplateEditorView } from "@/modules/documentTemplates/components/TemplateEditorView";

export default async function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TemplateEditorView key={id} templateId={id} />;
}
