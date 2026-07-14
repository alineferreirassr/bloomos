import { EventDetailPlaceholder } from "@/modules/events/components/EventDetailPlaceholder";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventDetailPlaceholder key={id} eventId={id} />;
}
