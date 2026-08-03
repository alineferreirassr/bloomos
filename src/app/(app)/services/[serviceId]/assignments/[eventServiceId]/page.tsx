import { EventServiceWorkspace } from "@/modules/services/components/EventServiceWorkspace";

export default async function EventServiceWorkspaceRoutePage({
  params,
}: {
  params: Promise<{ serviceId: string; eventServiceId: string }>;
}) {
  const { serviceId, eventServiceId } = await params;
  return <EventServiceWorkspace key={eventServiceId} serviceId={serviceId} eventServiceId={eventServiceId} />;
}
