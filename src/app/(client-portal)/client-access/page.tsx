import { getClientDashboardData } from "@/modules/clientAccess/getClientDashboardData";
import { ClientDashboardView } from "@/modules/dashboard/luxury/components/ClientDashboardView";
import { ErrorState } from "@/components/ui/ErrorState";

export default async function ClientAccessLandingPage() {
  const result = await getClientDashboardData();
  if (!result.success) return <ErrorState message={result.error} />;
  return <ClientDashboardView data={result.data} />;
}
