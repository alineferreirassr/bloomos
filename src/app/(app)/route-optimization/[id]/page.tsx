import { RouteDetailView } from "@/modules/routeOptimization/components/RouteDetailView";

export default async function RouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RouteDetailView routePlanId={id} />;
}
