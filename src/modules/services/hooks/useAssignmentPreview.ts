import { useQuery } from "@tanstack/react-query";
import { getAssignmentPreview } from "@/lib/queries/services";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { shouldRetryQuery } from "@/modules/services/hooks/errorContract";

/** A genuinely dependent query — only fires once a Service has actually been picked in the Assignment drawer; re-keyed (and refetched) on every add-on toggle since the price/counts depend on the exact selection. */
export function useAssignmentPreview(serviceId: string | undefined, selectedAddOnIds: string[]) {
  return useQuery({
    queryKey: serviceKeys.assignmentPreview(serviceId ?? "", selectedAddOnIds),
    queryFn: () => getAssignmentPreview(serviceId as string, selectedAddOnIds),
    enabled: Boolean(serviceId),
    staleTime: 0,
    retry: shouldRetryQuery,
  });
}
