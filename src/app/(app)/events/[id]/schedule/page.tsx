import { EventScheduleView } from "@/modules/events/components/EventScheduleView";

export default async function EventSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventScheduleView key={id} eventId={id} />;
}
