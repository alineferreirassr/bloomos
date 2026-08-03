import { useQuery } from "@tanstack/react-query";
import { getPublishPreview } from "@/lib/queries/services";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { shouldRetryQuery } from "@/modules/services/hooks/errorContract";

/** `enabled` also takes an `open` flag — the Publish Dialog should only fetch its preview once actually opened, not as part of the Editor's initial load (a deliberate lazy/dependent boundary). */
export function usePublishPreview(serviceId: string | undefined, options: { enabled?: boolean } = {}) {
  const enabled = Boolean(serviceId) && (options.enabled ?? true);
  return useQuery({
    queryKey: serviceKeys.publishPreview(serviceId ?? ""),
    queryFn: () => getPublishPreview(serviceId as string),
    enabled,
    staleTime: 0,
    retry: shouldRetryQuery,
  });
}
