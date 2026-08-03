import { useMutation, useQueryClient } from "@tanstack/react-query";
import { assignServiceToEvent, transitionEventServiceStatus, removeEventService } from "@/lib/data";
import type { AssignServiceToEventInput } from "@/modules/services/schema";
import type { EventServiceStatus } from "@/core/enums/eventServiceStatus";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { throwIfFailed } from "@/modules/services/hooks/errorContract";

/**
 * Invalidation matrix — Event assignment mutations:
 *
 * | Mutation  | Invalidates                                              | Leaves untouched |
 * |-----------|-------------------------------------------------------------|-------------------|
 * | assign    | assignmentWorkspace(eventId), lists(), editor(serviceId) (usageCount changed) | health()/versions()/templates() of the assigned Service — assignment never edits the catalog Service's own content, only how many EventServices reference it |
 * | transition status | eventServiceWorkspace(eventServiceId), assignmentWorkspace(eventId), and lists()+editor(serviceId) **only when transitioning to "cancelled"** | usage-dependent keys for every other transition — see the rule below |
 * | remove    | assignmentWorkspace(eventId), lists(), editor(serviceId); `eventServiceWorkspace(id)` is *removed* from the cache (not invalidated) | health()/versions()/templates() of the Service |
 *
 * **The usage-count rule, defined explicitly**: `usageCount` (see
 * core/workflows/eventServiceWorkflow.ts's `countsTowardServiceUsage`)
 * excludes only `cancelled` EventServices — `proposed`/`confirmed`/
 * `in_progress`/`completed` all count. `EVENT_SERVICE_TRANSITIONS`
 * guarantees `cancelled` is a true terminal status with zero outgoing
 * transitions, so the ONLY status change that can ever affect a Service's
 * usage count is a transition TO `cancelled` — every other transition
 * (proposed→confirmed, confirmed→in_progress, in_progress→completed) is
 * invisible to `usageCount` and must not trigger a catalog/search/editor
 * refetch. Removing an EventService always invalidates unconditionally —
 * simpler and always correct, at the acceptable cost of one occasionally
 * redundant refetch if the removed row happened to already be cancelled.
 *
 * `serviceId` is accepted alongside `eventServiceId`/`eventId` on the
 * transition/remove hooks purely so this invalidation can reach
 * `editor(serviceId)`/`lists()` — the repository calls themselves never
 * need it (`transitionEventServiceStatus`/`removeEventService` only take
 * the EventService's own id). The caller (Event Service Workspace) already
 * has the full `EventService` row loaded, which carries `service_id` for
 * free.
 *
 * **Disclosed gap, now resolved**: the "update EventService" mutation
 * (editing the live `name`/`price_minor` overrides after assignment) is
 * `useUpdateEventServiceOverrides` in
 * `useEventServiceOverrideMutations.ts` — kept in its own file since it's
 * a distinct concern from assign/transition/remove.
 */
export function useAssignServiceToEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignServiceToEventInput) => assignServiceToEvent(eventId, input).then(throwIfFailed),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.assignmentWorkspace(eventId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceKeys.editor(variables.service_id) });
    },
  });
}

export function useTransitionEventServiceStatus(eventServiceId: string, eventId: string, serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (to: EventServiceStatus) => transitionEventServiceStatus(eventServiceId, to).then(throwIfFailed),
    onSuccess: (_data, to) => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.eventServiceWorkspace(eventServiceId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.assignmentWorkspace(eventId) });
      if (to === "cancelled") {
        queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
        queryClient.invalidateQueries({ queryKey: serviceKeys.editor(serviceId) });
      }
    },
  });
}

export function useRemoveEventService(eventServiceId: string, eventId: string, serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => removeEventService(eventServiceId).then(throwIfFailed),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: serviceKeys.eventServiceWorkspace(eventServiceId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.assignmentWorkspace(eventId) });
      queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceKeys.editor(serviceId) });
    },
  });
}
