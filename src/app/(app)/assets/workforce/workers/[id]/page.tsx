import { WorkerCapabilityView } from "@/modules/capability/components/WorkerCapabilityView";

export default async function WorkerCapabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkerCapabilityView workerId={id} />;
}
