import { EventChecklistView } from "@/modules/events/components/EventChecklistView";

export default async function EventChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventChecklistView key={id} eventId={id} />;
}
