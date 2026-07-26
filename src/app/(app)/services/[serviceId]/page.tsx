import { ServiceDetailPage } from "@/modules/services/components/ServiceDetailPage";

export default async function ServiceDetailRoutePage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  return <ServiceDetailPage key={serviceId} serviceId={serviceId} />;
}
