import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fulfillEventServiceInventoryRequirement,
  linkEventServicePurchaseRequirementToPurchase,
  confirmEventServiceVendorAssignment,
  declineEventServiceVendorAssignment,
  submitEventServiceQuestionnaireResponse,
} from "@/lib/data";
import type { EventServiceQuestionnaireResponseInput } from "@/modules/services/schema";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { throwIfFailed } from "@/modules/services/hooks/errorContract";
import type { EventServiceWorkspaceData } from "@/lib/queries/services/types";

/**
 * Invalidation matrix — every mutation in this file:
 *
 * | Mutation | Invalidates | Leaves untouched |
 * |----------|--------------|-------------------|
 * | fulfill inventory / link purchase / confirm vendor / decline vendor / submit questionnaire response | eventServiceWorkspace(eventServiceId) only | every catalog-side key, `assignmentWorkspace(eventId)` — none of these ever change the Service catalog, its health, or the Event's assignment list |
 *
 * Optimistic updates (approved scope: "fulfil/confirm/decline" only) are
 * wired for fulfill/link/confirm/decline — all four are the same shape of
 * action (a quick, low-risk, easy-to-reverse-feeling toggle on one row).
 * Submitting a questionnaire response is immediate-autosave but
 * deliberately NOT optimistic: it's closer to a form-field commit than a
 * toggle, and waiting for the real response before showing success avoids
 * pretending a possibly-invalid answer was accepted.
 */
function useOptimisticEventServiceMutation<TArgs, TResult>(params: {
  eventServiceId: string;
  mutationFn: (args: TArgs) => Promise<TResult>;
  applyOptimistic: (previous: EventServiceWorkspaceData, args: TArgs) => EventServiceWorkspaceData;
}) {
  const queryClient = useQueryClient();
  const queryKey = serviceKeys.eventServiceWorkspace(params.eventServiceId);

  return useMutation({
    mutationFn: params.mutationFn,
    onMutate: async (args: TArgs) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<EventServiceWorkspaceData>(queryKey);
      if (previous) {
        queryClient.setQueryData<EventServiceWorkspaceData>(queryKey, params.applyOptimistic(previous, args));
      }
      return { previous };
    },
    onError: (_error, _args, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

function recomputeFulfillment(data: EventServiceWorkspaceData): EventServiceWorkspaceData["fulfillmentSummary"] {
  const { inventory, purchase, team, vendor } = data.requirements;
  const resolved =
    inventory.filter((r) => r.is_fulfilled).length +
    purchase.filter((r) => r.fulfilled_purchase_id !== null).length +
    team.filter((r) => r.assigned_member_id !== null).length +
    vendor.filter((r) => r.status !== "suggested").length;
  const total = inventory.length + purchase.length + team.length + vendor.length;
  return { resolved, total };
}

export function useFulfillEventServiceInventoryRequirement(eventServiceId: string) {
  const mutation = useOptimisticEventServiceMutation<string, unknown>({
    eventServiceId,
    mutationFn: (requirementId) => fulfillEventServiceInventoryRequirement(requirementId).then(throwIfFailed),
    applyOptimistic: (previous, requirementId) => {
      const next: EventServiceWorkspaceData = {
        ...previous,
        requirements: {
          ...previous.requirements,
          inventory: previous.requirements.inventory.map((r) => (r.id === requirementId ? { ...r, is_fulfilled: true } : r)),
        },
        fulfillmentSummary: previous.fulfillmentSummary,
      };
      return { ...next, fulfillmentSummary: recomputeFulfillment(next) };
    },
  });
  return mutation;
}

export function useLinkEventServicePurchaseRequirement(eventServiceId: string) {
  return useOptimisticEventServiceMutation<{ requirementId: string; purchaseId: string }, unknown>({
    eventServiceId,
    mutationFn: ({ requirementId, purchaseId }) => linkEventServicePurchaseRequirementToPurchase(requirementId, purchaseId).then(throwIfFailed),
    applyOptimistic: (previous, { requirementId, purchaseId }) => {
      const next: EventServiceWorkspaceData = {
        ...previous,
        requirements: {
          ...previous.requirements,
          purchase: previous.requirements.purchase.map((r) => (r.id === requirementId ? { ...r, fulfilled_purchase_id: purchaseId } : r)),
        },
        fulfillmentSummary: previous.fulfillmentSummary,
      };
      return { ...next, fulfillmentSummary: recomputeFulfillment(next) };
    },
  });
}

export function useConfirmEventServiceVendorAssignment(eventServiceId: string) {
  return useOptimisticEventServiceMutation<string, unknown>({
    eventServiceId,
    mutationFn: (assignmentId) => confirmEventServiceVendorAssignment(assignmentId).then(throwIfFailed),
    applyOptimistic: (previous, assignmentId) => {
      const next: EventServiceWorkspaceData = {
        ...previous,
        requirements: {
          ...previous.requirements,
          vendor: previous.requirements.vendor.map((r) => (r.id === assignmentId ? { ...r, status: "confirmed" } : r)),
        },
        fulfillmentSummary: previous.fulfillmentSummary,
      };
      return { ...next, fulfillmentSummary: recomputeFulfillment(next) };
    },
  });
}

export function useDeclineEventServiceVendorAssignment(eventServiceId: string) {
  return useOptimisticEventServiceMutation<string, unknown>({
    eventServiceId,
    mutationFn: (assignmentId) => declineEventServiceVendorAssignment(assignmentId).then(throwIfFailed),
    applyOptimistic: (previous, assignmentId) => {
      const next: EventServiceWorkspaceData = {
        ...previous,
        requirements: {
          ...previous.requirements,
          vendor: previous.requirements.vendor.map((r) => (r.id === assignmentId ? { ...r, status: "declined" } : r)),
        },
        fulfillmentSummary: previous.fulfillmentSummary,
      };
      return { ...next, fulfillmentSummary: recomputeFulfillment(next) };
    },
  });
}

/** Immediate-autosave, not optimistic — see this file's own doc comment for why. */
export function useSubmitEventServiceQuestionnaireResponse(eventServiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EventServiceQuestionnaireResponseInput) => submitEventServiceQuestionnaireResponse(eventServiceId, input).then(throwIfFailed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.eventServiceWorkspace(eventServiceId) });
    },
  });
}

