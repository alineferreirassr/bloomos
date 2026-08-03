import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateServiceVersionDraft, publishServiceVersion } from "@/lib/data";
import type { ServiceVersionInput, PublishServiceVersionInput } from "@/modules/services/schema";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { throwIfFailed } from "@/modules/services/hooks/errorContract";

/**
 * Invalidation matrix — Draft Version mutations:
 *
 * | Mutation  | Invalidates                                                                 | Leaves untouched |
 * |-----------|-------------------------------------------------------------------------------|-------------------|
 * | update draft (price/duration/etc.) | editor(id), versions(id), health(id), lists(), healthDashboards() | templates(versionId) — template ROWS are untouched by the version's own scalar fields |
 * | publish   | detail(id) [broad — covers editor/versions/health/publishPreview], templates(oldDraftId), lists(), healthDashboards() | every `eventServiceWorkspace`/`assignmentWorkspace` key — an already-assigned EventService is pinned to the version it was assigned under and never reads a later publish |
 *
 * `versions(id)` is invalidated on a draft update because the version list
 * displays each row's own `base_price_minor`/etc. — the current draft's row
 * in that list would otherwise show a stale price.
 *
 * Publish cannot target-invalidate the brand-new draft's own
 * `templates(newDraftId)` key, because the RPC's response only returns the
 * now-published version, not the id of the draft it just created — the new
 * draft's Template Builder query is a fresh cache miss the first time
 * anyone opens it, never a stale-cache problem needing invalidation.
 */
export function useUpdateServiceVersionDraft(serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceVersionInput) => updateServiceVersionDraft(serviceId, input).then(throwIfFailed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.editor(serviceId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.versions(serviceId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.health(serviceId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceKeys.healthDashboards() });
    },
  });
}

export function usePublishServiceVersion(serviceId: string, currentDraftVersionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PublishServiceVersionInput) => publishServiceVersion(serviceId, input).then(throwIfFailed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(serviceId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.templates(currentDraftVersionId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceKeys.healthDashboards() });
    },
  });
}
