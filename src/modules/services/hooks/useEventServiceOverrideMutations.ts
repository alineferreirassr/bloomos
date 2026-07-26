import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateEventServiceOverrides } from "@/lib/data";
import type { UpdateEventServiceOverridesInput } from "@/modules/services/schema";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { throwIfFailed } from "@/modules/services/hooks/errorContract";

/**
 * Invalidation matrix — EventService override mutation:
 *
 * | Mutation           | Invalidates                                                | Leaves untouched |
 * |--------------------|-------------------------------------------------------------|-------------------|
 * | update overrides   | eventServiceWorkspace(eventServiceId); assignmentWorkspace(eventId) if passed; assignments(serviceId) if passed | catalog (`lists()`, `detail()`, `health()`), templates, versions — an instance-level override never touches the catalog Service or its pinned ServiceVersion |
 *
 * `eventId`/`serviceId` are both optional because this hook is reachable
 * from two different screens that each only know one side of the
 * relationship at call time (an Event-scoped workspace knows its `eventId`
 * but not which catalog Service produced this EventService; the Event
 * Assignment tab, added in Checkpoint 9, knows the opposite) — passing
 * whichever one the caller actually has keeps that screen's own cached list
 * in sync without forcing the other screen to supply an id it doesn't have.
 *
 * No optimistic update, deliberately: price is financially meaningful, and
 * the future UI's own design calls for explicit Save on price/financial
 * overrides rather than autosave — waiting for the confirmed server
 * response here matches that, rather than briefly showing a value the
 * server could still reject (e.g. once the EventService has reached a
 * terminal status).
 *
 * `isNameOverridden`/`isPriceOverridden` need no separate update path —
 * they're computed by comparing the live fields this mutation writes
 * against `name_template_value`/`price_template_value`, which this
 * mutation can never touch. "Clearing" an override is not a distinct
 * operation: passing a value that happens to equal the template value is a
 * perfectly normal update, after which the comparison naturally reports
 * `false` again.
 */
export function useUpdateEventServiceOverrides(eventServiceId: string, eventId?: string, serviceId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEventServiceOverridesInput) => updateEventServiceOverrides(eventServiceId, input).then(throwIfFailed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.eventServiceWorkspace(eventServiceId) });
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: serviceKeys.assignmentWorkspace(eventId) });
      }
      if (serviceId) {
        queryClient.invalidateQueries({ queryKey: serviceKeys.assignments(serviceId) });
      }
    },
  });
}
