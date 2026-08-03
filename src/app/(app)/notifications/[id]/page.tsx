import { NotificationDetailView } from "@/modules/notifications/components/NotificationDetailView";

export default async function NotificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NotificationDetailView id={id} />;
}
