import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateChecklistItemStatus } from "@/lib/data";
import type { ChecklistStatus } from "@/core/enums/checklistStatus";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { throwIfFailed } from "@/modules/services/hooks/errorContract";

/**
 * The one and only mutation the Workspace's Template Execution section
 * needs — `updateChecklistItemStatus` already exists on the Events
 * repository (used today by `ChecklistItemRow` via a plain call + local
 * `useState`, not a hook); this wraps that exact same function in the
 * Services module's own `useMutation` convention so the Workspace gets
 * proper cache invalidation instead of the manual refetch pattern the
 * Events module uses. No new repository method, no new business logic —
 * only a thin adapter.
 */
export function useUpdateChecklistItemStatus(eventServiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ChecklistStatus }) => updateChecklistItemStatus(id, status).then(throwIfFailed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.eventServiceChecklist(eventServiceId) });
    },
  });
}
