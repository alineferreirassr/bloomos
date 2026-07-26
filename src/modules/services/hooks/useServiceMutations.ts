import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createService, updateService, activateService, deactivateService, archiveService, restoreService } from "@/lib/data";
import type { ServiceInput } from "@/modules/services/schema";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { throwIfFailed } from "@/modules/services/hooks/errorContract";

/**
 * Invalidation matrix — Service catalog-identity mutations:
 *
 * | Mutation                          | Invalidates                                  | Leaves untouched |
 * |------------------------------------|-----------------------------------------------|-------------------|
 * | create                             | lists()                                        | everything else — no existing Service is affected |
 * | update (name/category/description) | editor(id), lists()                            | versions, health, publishPreview, templates(versionId) — none of them read name/category/description |
 * | activate/deactivate/archive/restore| editor(id), lists(), healthDashboards()        | versions, health, templates(versionId) — status never feeds the health heuristic or template content |
 *
 * None of these ever touch `assignmentWorkspace`/`eventService*` keys — an
 * already-assigned EventService is pinned to its historical
 * name_template_value/price_template_value and reads none of these fields
 * live.
 */
export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceInput) => createService(input).then(throwIfFailed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

export function useUpdateService(serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceInput) => updateService(serviceId, input).then(throwIfFailed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.editor(serviceId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

function useServiceStatusMutation(mutationFn: (id: string) => ReturnType<typeof activateService>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: string) => mutationFn(serviceId).then(throwIfFailed),
    onSuccess: (_data, serviceId) => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.editor(serviceId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceKeys.healthDashboards() });
    },
  });
}

export function useActivateService() {
  return useServiceStatusMutation(activateService);
}
export function useDeactivateService() {
  return useServiceStatusMutation(deactivateService);
}
export function useArchiveService() {
  return useServiceStatusMutation(archiveService);
}
export function useRestoreService() {
  return useServiceStatusMutation(restoreService);
}
