import { IntegrationConnectionDetailView } from "@/modules/integrations/components/IntegrationConnectionDetailView";

export default async function IntegrationProviderDetailPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  return <IntegrationConnectionDetailView providerId={provider} />;
}
