import { useQuery } from "@tanstack/react-query";
import { getEventServiceWorkspace } from "@/lib/queries/services";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { shouldRetryQuery } from "@/modules/services/hooks/errorContract";

export function useEventServiceWorkspace(eventServiceId: string | undefined) {
  return useQuery({
    queryKey: serviceKeys.eventServiceWorkspace(eventServiceId ?? ""),
    queryFn: () => getEventServiceWorkspace(eventServiceId as string),
    enabled: Boolean(eventServiceId),
    staleTime: 0,
    retry: shouldRetryQuery,
  });
}
