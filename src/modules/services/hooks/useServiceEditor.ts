import { useQuery } from "@tanstack/react-query";
import { getServiceEditor } from "@/lib/queries/services";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { shouldRetryQuery } from "@/modules/services/hooks/errorContract";

/** No stale time — this is an actively-edited screen; showing anything but the latest known state would mean showing a wrong price/status, not just an old one. */
export function useServiceEditor(serviceId: string | undefined) {
  return useQuery({
    queryKey: serviceKeys.editor(serviceId ?? ""),
    queryFn: () => getServiceEditor(serviceId as string),
    enabled: Boolean(serviceId),
    staleTime: 0,
    retry: shouldRetryQuery,
  });
}
