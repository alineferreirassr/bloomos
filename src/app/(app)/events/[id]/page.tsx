import { EventDetailView } from "@/modules/events/components/EventDetailView";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventDetailView key={id} eventId={id} />;
}
