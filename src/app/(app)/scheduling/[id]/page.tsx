import { CalendarDetailView } from "@/modules/scheduling/components/CalendarDetailView";

export default async function SchedulingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CalendarDetailView calendarId={id} />;
}
