import { EditEventView } from "@/modules/events/components/EditEventView";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditEventView key={id} eventId={id} />;
}
