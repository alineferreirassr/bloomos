import { useQuery } from "@tanstack/react-query";
import { getServiceAssignments } from "@/lib/queries/services";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { shouldRetryQuery } from "@/modules/services/hooks/errorContract";

export function useServiceAssignments(serviceId: string | undefined) {
  return useQuery({
    queryKey: serviceKeys.assignments(serviceId ?? ""),
    queryFn: () => getServiceAssignments(serviceId as string),
    enabled: Boolean(serviceId),
    staleTime: 0,
    retry: shouldRetryQuery,
  });
}
