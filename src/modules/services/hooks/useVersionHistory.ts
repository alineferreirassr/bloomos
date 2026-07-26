import { useQuery } from "@tanstack/react-query";
import { getVersionHistory } from "@/lib/queries/services";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { shouldRetryQuery } from "@/modules/services/hooks/errorContract";

export function useVersionHistory(serviceId: string | undefined) {
  return useQuery({
    queryKey: serviceKeys.versions(serviceId ?? ""),
    queryFn: () => getVersionHistory(serviceId as string),
    enabled: Boolean(serviceId),
    staleTime: 0,
    retry: shouldRetryQuery,
  });
}
