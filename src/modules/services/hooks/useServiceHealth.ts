import { useQuery } from "@tanstack/react-query";
import { getServiceHealth } from "@/lib/queries/services";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { shouldRetryQuery } from "@/modules/services/hooks/errorContract";

export function useServiceHealth(serviceId: string | undefined) {
  return useQuery({
    queryKey: serviceKeys.health(serviceId ?? ""),
    queryFn: () => getServiceHealth(serviceId as string),
    enabled: Boolean(serviceId),
    staleTime: 0,
    retry: shouldRetryQuery,
  });
}
