import { useQuery } from "@tanstack/react-query";
import { getTemplateBuilder } from "@/lib/queries/services";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { shouldRetryQuery } from "@/modules/services/hooks/errorContract";

export function useTemplateBuilder(serviceVersionId: string | undefined) {
  return useQuery({
    queryKey: serviceKeys.templates(serviceVersionId ?? ""),
    queryFn: () => getTemplateBuilder(serviceVersionId as string),
    enabled: Boolean(serviceVersionId),
    staleTime: 0,
    retry: shouldRetryQuery,
  });
}
