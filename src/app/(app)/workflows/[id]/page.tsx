import { WorkflowEditorView } from "@/modules/workflow/components/WorkflowEditorView";

export default async function WorkflowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkflowEditorView key={id} workflowId={id} />;
}
