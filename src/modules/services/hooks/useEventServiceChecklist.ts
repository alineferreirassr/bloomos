import { useQuery } from "@tanstack/react-query";
import { getEventServiceChecklistItems } from "@/lib/queries/services";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { shouldRetryQuery } from "@/modules/services/hooks/errorContract";

/** `eventId` is only known once the Workspace's own `useEventServiceWorkspace` query has resolved — disabled until then, same `enabled` gating `useEventServiceWorkspace` itself uses for `eventServiceId`. */
export function useEventServiceChecklist(eventServiceId: string, eventId: string | undefined) {
  return useQuery({
    queryKey: serviceKeys.eventServiceChecklist(eventServiceId),
    queryFn: () => getEventServiceChecklistItems(eventServiceId, eventId as string),
    enabled: Boolean(eventId),
    retry: shouldRetryQuery,
  });
}
